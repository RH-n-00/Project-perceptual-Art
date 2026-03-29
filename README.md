
# Interactive Perceptual Hailstone — Stage 4 Prototype

This artifact is a Step 4 hailstone sculpture prototype aligned to the locked concept.
It focuses on the shell only:

- dark ash background (`#23272B`)
- Icosahedron-based hailstone silhouette
- Perlin-noise-driven vertex displacement
- translucent, frosted ice material
- slow multi-axis auto rotation
- mouse / touch rotation with pan and zoom disabled
- empty `PerceptualContentRoot` placeholder for later `HALE / HAIL / Union Jack` volumes

## Files

- `index.html` — entry point
- `styles.css` — fullscreen layout and minimal hint UI
- `src/main.js` — scene setup, lighting, controls, motion
- `src/hailstone.js` — hailstone mesh generation and material layering
- `vendor/three/*` — vendored three.js r183 modules

## Notes

This prototype intentionally does **not** include the perceptual text / flag layers.
It is a shell-and-material milestone meant to validate the hailstone object before Step 5 integration.

## GitHub Pages

The project is a static site. Upload the folder contents to a repository root (or `/docs`) and enable GitHub Pages.
No build step is required.
