import { ReactNode } from "react";
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
  children: ReactNode;
};

export function AdminCard({ title, description, className = "", children }: AdminCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="adminCardHeader">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
