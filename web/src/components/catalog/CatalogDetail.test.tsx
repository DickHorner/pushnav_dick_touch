import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BafkObject } from "@/lib/bafk";
import { CatalogDetail } from "./CatalogDetail";

const object: BafkObject = {
  id: "p004-00", name: "M 31", constellation: "And",
  ra_deg: 10.684, dec_deg: 41.269, aperture: "FG",
  filter: "--", type: "Gx", page: 4,
  description: "Andromedagalaxie", images: ["p004-00.jpg"],
};

function renderBafk(images: string[]) {
  render(
    <CatalogDetail
      input={{ kind: "bafk", object: { ...object, images } }}
      location={null}
      evalAt={new Date("2026-11-14T20:00:00Z")}
    />,
  );
}

describe("BAfK illustration rendering", () => {
  it("shows dark atlas structures in red while preserving the original image URL", () => {
    renderBafk(["p004-00.jpg"]);
    const image = screen.getByRole("img", { name: "BAfK-Abbildung zu M 31" });
    const link = image.closest("a");

    expect(image).toHaveClass("grayscale", "invert", "contrast-125", "mix-blend-multiply");
    expect(link).toHaveClass("bg-[#ff2020]");
    expect(image).toHaveAttribute("src", "/api/bafk/images/p004-00.jpg");
    expect(link).toHaveAttribute("href", "/api/bafk/images/p004-00.jpg");
  });

  it("renders no illustration when the object has none", () => {
    renderBafk([]);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
