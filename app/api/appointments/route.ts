import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureCustomerForAppointment } from "@/lib/ensureCustomerForAppointment";

type CreateAppointmentInput = {
  businessId: string;
  serviceId?: string | null;
  customerId?: string | null;
  customerName?: string;
  bookedForName?: string;
  bookedForRelationship?: string;
  bookedForPhone?: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  /** Se false, não cria/vincula cliente automático (padrão: true quando customerId omitido). */
  autoCreateCustomer?: boolean;
};

function applyMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toIso(value: Date) {
  return value.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const date = request.nextUrl.searchParams.get("date");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("appointments")
      .select(
        "id, business_id, service_id, customer_id, customer_name, customer_phone, booked_for_name, booked_for_relationship, booked_for_phone, starts_at, ends_at, status, notes"
      )
      .eq("business_id", businessId)
      .order("starts_at", { ascending: true })
      .limit(100);

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      const end = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      query = query.gte("starts_at", start).lte("starts_at", end);
    } else if (date) {
      const start = new Date(`${date}T00:00:00.000Z`).toISOString();
      const end = new Date(`${date}T23:59:59.999Z`).toISOString();
      query = query.gte("starts_at", start).lte("starts_at", end);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Falha ao listar agendamentos." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateAppointmentInput;

    if (!body.businessId || !body.customerPhone || !body.startsAt || !body.endsAt) {
      return NextResponse.json(
        { error: "businessId, customerPhone, startsAt e endsAt sao obrigatorios." },
        { status: 400 }
      );
    }

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { error: "Formato de data invalido para startsAt/endsAt." },
        { status: 400 }
      );
    }
    if (startsAt >= endsAt) {
      return NextResponse.json(
        { error: "startsAt deve ser menor que endsAt." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let resolvedCustomerId = body.customerId ?? null;
    const auto =
      body.autoCreateCustomer !== false &&
      !resolvedCustomerId &&
      Boolean(body.businessId && body.customerPhone);

    if (auto) {
      const ensured = await ensureCustomerForAppointment({
        businessId: body.businessId,
        customerPhone: body.customerPhone,
        customerName: body.customerName
      });
      if (ensured) {
        resolvedCustomerId = ensured;
      }
    }

    if (resolvedCustomerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, is_blocked, block_reason")
        .eq("id", resolvedCustomerId)
        .eq("business_id", body.businessId)
        .maybeSingle();
      if (customer?.is_blocked) {
        return NextResponse.json(
          {
            error:
              customer.block_reason ||
              "Cliente bloqueado temporariamente para novos agendamentos."
          },
          { status: 403 }
        );
      }
    }

    const { data: businessRules } = await supabase
      .from("businesses")
      .select(
        "booking_buffer_before_minutes, booking_buffer_after_minutes, booking_slot_capacity, waitlist_enabled, subscription_plan_code, subscription_status, monthly_appointment_limit"
      )
      .eq("id", body.businessId)
      .single();

    const bufferBefore = Math.max(
      0,
      Number(businessRules?.booking_buffer_before_minutes || 0)
    );
    const bufferAfter = Math.max(0, Number(businessRules?.booking_buffer_after_minutes || 0));
    const slotCapacity = Math.max(1, Number(businessRules?.booking_slot_capacity || 1));
    const waitlistEnabled = businessRules?.waitlist_enabled !== false;
    const subscriptionStatus = String(businessRules?.subscription_status || "active");
    const monthlyLimitRaw = businessRules?.monthly_appointment_limit;
    const monthlyLimit =
      monthlyLimitRaw == null ? null : Math.max(1, Math.floor(Number(monthlyLimitRaw)));

    if (subscriptionStatus === "cancelled" || subscriptionStatus === "past_due") {
      return NextResponse.json(
        { error: "Plano inativo. Regularize a assinatura para continuar agendando." },
        { status: 402 }
      );
    }

    if (monthlyLimit != null) {
      const startOfMonth = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), 1));
      const endOfMonth = new Date(
        Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth() + 1, 1) - 1
      );
      const { count: monthCount, error: monthCountError } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", body.businessId)
        .gte("starts_at", startOfMonth.toISOString())
        .lte("starts_at", endOfMonth.toISOString())
        .not("status", "eq", "cancelled");
      if (monthCountError) {
        return NextResponse.json(
          { error: "Falha ao validar limite mensal do plano." },
          { status: 500 }
        );
      }
      if (Number(monthCount || 0) >= monthlyLimit) {
        return NextResponse.json(
          {
            error: `Limite mensal do plano atingido (${monthlyLimit} agendamentos).`,
            monetization: {
              monthlyLimit,
              currentCount: Number(monthCount || 0),
              planCode: String(businessRules?.subscription_plan_code || "free")
            }
          },
          { status: 402 }
        );
      }
    }

    const startsAtWithBuffer = applyMinutes(startsAt, -bufferBefore);
    const endsAtWithBuffer = applyMinutes(endsAt, bufferAfter);

    const { data: overlappingAppointments, error: overlapError } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at")
      .eq("business_id", body.businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAtWithBuffer.toISOString())
      .gt("ends_at", startsAtWithBuffer.toISOString())
      .limit(50);

    if (overlapError) {
      return NextResponse.json(
        { error: "Falha ao validar conflitos de agenda." },
        { status: 500 }
      );
    }

    const overlappingCount = (overlappingAppointments || []).filter((item) => {
      const existingStart = applyMinutes(
        new Date(item.starts_at),
        -bufferBefore
      ).getTime();
      const existingEnd = applyMinutes(new Date(item.ends_at), bufferAfter).getTime();
      return startsAtWithBuffer.getTime() < existingEnd && endsAtWithBuffer.getTime() > existingStart;
    }).length;
    const hasConflict = overlappingCount >= slotCapacity;

    if (hasConflict) {
      const durationMinutes = Math.max(
        1,
        Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
      );
      const nextStartAt = (overlappingAppointments || []).reduce((latest, item) => {
        const blockedUntil = applyMinutes(
          new Date(item.ends_at),
          bufferAfter + bufferBefore
        ).getTime();
        return Math.max(latest, blockedUntil);
      }, startsAt.getTime());
      const nextEndAt = applyMinutes(new Date(nextStartAt), durationMinutes);
      return NextResponse.json(
        {
          error:
            "Horario indisponivel considerando tempo de preparacao/limpeza entre agendamentos.",
          conflict: {
            reason: "buffer_overlap",
            suggestedStartAt: toIso(new Date(nextStartAt)),
            suggestedEndAt: toIso(nextEndAt),
            slotCapacity,
            overlappingCount,
            waitlistEligible: waitlistEnabled
          }
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        business_id: body.businessId,
        service_id: body.serviceId ?? null,
        customer_id: resolvedCustomerId,
        customer_name: body.customerName?.trim() || null,
        customer_phone: body.customerPhone.trim(),
        booked_for_name: body.bookedForName?.trim() || null,
        booked_for_relationship: body.bookedForRelationship?.trim() || null,
        booked_for_phone: body.bookedForPhone?.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        notes: body.notes?.trim() || null
      })
      .select(
        "id, business_id, service_id, customer_id, customer_name, customer_phone, booked_for_name, booked_for_relationship, booked_for_phone, starts_at, ends_at, status"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao criar agendamento." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Agendamento criado com sucesso.", data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
