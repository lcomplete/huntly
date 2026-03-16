/** @jest-environment jsdom */

import {
  calculateExportScale,
  sanitizeClonedMediaForExport,
} from "../utils/exportUtils";

function createDomRect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("calculateExportScale", () => {
  it("keeps the default scale for regular content sizes", () => {
    expect(calculateExportScale(900, 1200)).toBe(2);
  });

  it("keeps long but still safe pages at 2x quality", () => {
    expect(calculateExportScale(1200, 15000)).toBe(2);
  });

  it("reduces the scale for very large exports", () => {
    expect(calculateExportScale(9000, 20000)).toBeLessThan(2);
  });
});

describe("sanitizeClonedMediaForExport", () => {
  it("replaces images that fail the canvas taint test and strips unsafe backgrounds", () => {
    const original = document.createElement("div");

    const externalImage = document.createElement("img");
    externalImage.src = "https://cdn.example.com/image.png";
    externalImage.alt = "External image";
    externalImage.getBoundingClientRect = () => createDomRect(320, 180);

    const localImage = document.createElement("img");
    localImage.src = "/local-image.png";
    localImage.getBoundingClientRect = () => createDomRect(120, 80);

    const backgroundNode = document.createElement("div");
    backgroundNode.style.backgroundImage =
      'url("https://cdn.example.com/background.png")';

    original.append(externalImage, localImage, backgroundNode);

    const cloned = original.cloneNode(true) as HTMLDivElement;
    sanitizeClonedMediaForExport(
      original,
      cloned,
      "http://localhost",
      "http://localhost/article"
    );

    // In jsdom (no canvas support), all images fail the taint test and
    // get replaced with placeholders — this is the safe default.
    const placeholders = cloned.querySelectorAll(
      '[data-huntly-export-omitted="true"]'
    );
    expect(placeholders.length).toBe(2);
    expect(cloned.textContent).toContain("External image");
    expect(cloned.querySelectorAll("img")).toHaveLength(0);

    // Background images from cross-origin URLs are stripped
    expect(
      (cloned.lastElementChild as HTMLDivElement).style.backgroundImage
    ).toBe("none");
  });
});
