import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StateCardProps = {
  title: string;
  description: string;
  kind?: "empty" | "error";
  actionLabel?: string;
  actionHref?: string;
  action?: () => void;
  children?: ReactNode;
};

export default function StateCard({
  title,
  description,
  kind = "empty",
  actionLabel,
  actionHref,
  action,
  children,
}: StateCardProps) {
  const Icon = kind === "error" ? AlertTriangle : Inbox;

  return (
    <Card className={kind === "error" ? "border-destructive/30 bg-destructive/5" : "border-dashed"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={kind === "error" ? "h-5 w-5 text-destructive" : "h-5 w-5 text-primary"} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {actionLabel && actionHref && (
          <Link to={actionHref} className="inline-block">
            <Button size="sm">{actionLabel}</Button>
          </Link>
        )}
        {actionLabel && action && (
          <Button size="sm" onClick={action}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
