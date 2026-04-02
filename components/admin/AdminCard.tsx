import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type AdminCardProps = {
  title: string;
  description?: string;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
};

export function AdminCard({
  title,
  description,
  className = "",
  headerClassName,
  children
}: AdminCardProps) {
  return (
    <Card className={className}>
      <CardHeader className={cn("adminCardHeader", headerClassName)}>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
