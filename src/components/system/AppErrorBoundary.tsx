import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logClientError } from "@/lib/observability";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Evita crash silencioso em produção e permite rastrear no console.
    console.error("AppErrorBoundary", { error, info });
    void logClientError({
      scope: "app",
      message: error.message,
      stack: error.stack || null,
      metadata: {
        componentStack: info.componentStack,
      },
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Ops, rolou uma falha inesperada</CardTitle>
              <CardDescription>
                A gente segurou o erro para o sistema não quebrar na sua frente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={this.handleReload}>
                Recarregar sistema
              </Button>
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">
                  Voltar para o início
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
