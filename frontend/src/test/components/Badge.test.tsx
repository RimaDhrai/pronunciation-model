import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge component", () => {
  it("affiche le texte passé en enfant", () => {
    render(<Badge>A1</Badge>);
    expect(screen.getByText("A1")).toBeDefined();
  });

  it("applique la variante 'default' par défaut", () => {
    const { container } = render(<Badge>B2</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("bg-primary");
  });

  it("applique la variante 'destructive'", () => {
    const { container } = render(<Badge variant="destructive">Erreur</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("destructive");
  });

  it("applique la variante 'secondary'", () => {
    const { container } = render(<Badge variant="secondary">C1</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("secondary");
  });

  it("applique la variante 'outline'", () => {
    const { container } = render(<Badge variant="outline">C2</Badge>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("outline");
  });

  it("fusionne les classes CSS additionnelles", () => {
    const { container } = render(
      <Badge className="custom-class">Test</Badge>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom-class");
  });
});
