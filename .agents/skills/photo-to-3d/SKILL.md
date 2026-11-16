---
name: photo-to-3d
description: Reconstruct 3D models from a single photograph, product image, approved artwork, or set of reference views. Use for objects, furniture, clothing, characters, organic subjects, or scenes. Covers reference cleanup and additional views with ImageGen, material and texture creation, detailed modeling with Blender MCP, iterative reference checks, and export.
---

# Reconstruct 3D Models from Photos

Start from the supplied references when the user asks to turn an image into a 3D model. Follow the requested subject, intended use, and production stage. For a complete reconstruction, default to an editable model with a preview the user can rotate and zoom. Add animation, assembly, or scene integration as the intended use requires. Ask for clarification only when the subject or intended use would materially change the result and cannot be inferred from context.

## 1. Original Image and Clean Primary Reference

- Save the original image and its framing as the baseline for reconstruction and camera matching. Identify the silhouette, relative proportions, pose, part connections, patterns, and asymmetry that make the subject recognizable. Choose landmarks that are easy to compare, such as the height of a chair seat relative to its backrest, a handle's mounting points, facial proportions, or garment seams.
- When the primary image needs cleanup, edit it with ImageGen to remove the background, supports, and unrelated objects that obscure the subject. Specify the original viewpoint, perspective, pose, proportions, and identifying details as constraints. Choose a neutral or transparent background to suit the use. Check that the subject is complete. For transparent backgrounds, inspect the actual alpha channel, including hair, thin parts, and translucent edges.
- Overlay the cleaned image on the original at the same scale. Check the silhouette, patterns, lettering, and accessory placement. Correct any drift locally and use features that are verifiable in the original to guide modeling.

## 2. Multiple Reference Views and Inferred Structure

- Use existing photographs first. When an angle is missing, use ImageGen with the original and selected primary image to produce the view that best resolves a structural question. Add front, side, rear, three-quarter, top, bottom, or detail views as needed. Use near-orthographic views aligned with the relevant axes when measuring proportions. Keep the subject, pose, scale, palette, and accessory placement consistent across views.
- Align the ground plane or principal axis across views and compare shared landmarks for height, thickness, connections, and left-right placement. Resolve conflicts in generated views using features visible in the original and other photographs. Once the blockout is ready, render side and rear views to check that the references can describe a single coherent model.
- Record the source of each reference, including photographs, user-approved artwork, and generated views. Infer concealed areas, thickness, and rear details from how the parts fit together, typical construction, or reliable references for similar subjects. Note any inferred details that affect the appearance. Use relative proportions when there is no known scale. When accurate rear geometry or physical dimensions are required, use an additional photograph that resolves the uncertainty or a known measurement.

## 3. Material Samples and Texture Maps

- Inspect close crops of the original to identify patterns, detail scale, surface relief, and direction. Use ImageGen to create evenly lit, high-quality material samples as needed. For tiled materials such as fabric and wood, check seams, repetition, and grain direction. Match the size and placement of markings, seams, and local patterns to the original.
- Create a base color map and any roughness, normal, height, metallic, or opacity maps the material needs. Reduce baked shadows and highlights in the base color so reflections respond to the actual lighting. Choose texture density based on viewing distance and close-up requirements. Set the color space according to each map's encoding. Use sRGB for standard base color PNGs and Non-Color for data maps such as normals, roughness, and metallic. Once the UVs are final, align and bake the maps, then inspect their edges.
- Test a representative patch of hair, plush fabric, glass, or thin material in the target renderer. Short pile should show fiber direction, shadows between tufts, and localized highlights. Use fine fibers where the pile affects the silhouette. Inspect transparent and translucent edges and light transmission against both light and dark backgrounds. Use rotation and changes in lighting to judge how the material should behave on the full model.

## 4. Detailed Modeling in Blender

- Prefer the connected Blender MCP to inspect the scene, edit a working copy, and capture previews. Stage the setup, blockout, detailing, materials, and export according to the tools available. Use Blender Python or its command line for repeatable bakes and batch renders. If MCP is unavailable, continue with the local Blender application or command line.
- Place the relevant reference views and establish the axes, baseline, and scale. Match the original camera angle, perspective, and subject pose with a neutral gray blockout. Overlay the silhouette and landmarks, then check volume and connections from the side and rear. Once the volumes align, refine thickness, curvature, bevels, seams, and surface relief. Use geometry or fibers for details that affect the silhouette or occlusion.
- If an automatically reconstructed rough mesh is available, bring it into Blender as a volume reference. Check the silhouette, thickness, and openings from the original viewpoint under neutral lighting. If the mesh fuses a lid, knob, or other moving part, rebuild it as separate geometry with the appropriate connection, pivot, and interior surfaces exposed during movement.
- Keep the parts, UVs, materials, and reference camera editable. Check texture direction, pattern alignment across seams, and where attached parts make contact. For animation, use motion references to establish the rest pose, pivots, and deformation. Check the rig at extreme poses for unwanted intersections.

## 5. Compare, Revise, and Verify

1. Compare the silhouette, proportions, landmarks, and patterns from the original camera at the same scale. Match the identifiable lighting and record differences that affect the comparison. Inspect the volume, seams, contact points, and texture scale in close-up and from three-quarter, side, and rear views. Change the light or viewing angle to check the material response. For animation, check key poses and review the complete motion.
2. When assembly, fit, or moving parts are part of the deliverable, generate sections or exploded views from the actual mesh wherever they reveal details that need checking. Inspect hole placement, wall thickness, and clearance at key interfaces. Test closed, open, and intermediate positions to verify pivots, fit, and room to move.
3. Diagnose issues at their source. Check the camera and blockout for silhouette errors, UVs and maps for drifting patterns, and roughness, texture direction, and lighting for surfaces that look too bright or uniform. If the target viewer shows a discrepancy, compare it with Blender and inspect the exported material channels, renderer support, or compression.
4. Keep a recoverable version of the project and comparison frames. After changes, rerender with the same camera, lighting, scale, and pose, and check any neighboring parts affected by the revision. Reopen the actual export. Iterate until the key features and requested interactions meet the goal, and document any assumptions that still need confirmation.

## 6. Export and Delivery

- For the full workflow, deliver an editable `.blend`, a textured `.glb`, a single-file HTML viewer that supports offline rotation and zoom, and a comparison between the original image and the actual delivered model from the same angle. Use the target project's preview workflow or make a standalone preview. If the user specifies an engine, 3D printing, or another use, adapt the format and geometry, scale, and material checks to that target.
- Reopen the Blender project to verify its dependencies. For assets with separate parts, animation, or complex materials, import the exported GLB into an empty scene and compare critical parts, dimensions, orientation, pivots, materials, and animation with the source project. Bake or recreate complex materials as supported by the target. Then open the deliverable in the target viewer and check geometry, appearance, and interaction. Embed the model and rendering dependencies in the single-file HTML, then open it offline and verify loading, rotation, zoom, and any requested motion.
- Keep the selected primary image, additional views, source material images, and key prompts with the asset. Provide usable files and comparison images. Report the basis for any estimated scale, inferred side or rear details, and the checks performed.
