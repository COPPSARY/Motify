# Claude · UI Construction, Image Generation, Mobile Sync & Climax Film (21.0s)

A continuous, reference-grade motion graphics film recreating Claude's complete user journey across three cinematic acts and a grand optical climax:

**Act 1 opens with the architectural construction of Claude's dark UI featuring the authentic 260px Claude sidebar (with serif Claude logo, `+ New` button, Projects, Artifacts, Code, Customize, and recent chats list) alongside the hero greeting "Good Morning, Sou". An oversized pointer drags a clean ramen dish image into the Big Prompt Box. Instead of an abrupt camera snap, the camera initiates a gentle 1.5s push-in that smoothly settles into dead-center left framing as the image docks into its 72px slot with zero duplicate background or polaroid borders. Upon docking, a sharp radiant terracotta glow beam begins continuously and smoothly traveling around the perimeter of the box without disappearing. The "How can I help you today?" placeholder instantly disappears, leaving only the image and the blinking caret. After a steady 0.5s pause, stepped typing reveals: "How many calories are in this ramen meal?" with camera follow-pan. The camera pans to center the orange send button as the cursor clicks it. The scene transitions to the response view where the camera stays zoomed close (scale: 1.35) so the response text and Calorie Breakdown Artifact card are large and prominent, with itemized breakdown lines (~590 kcal) and Claude's floating bottom chat bar cleanly visible beneath the conversation.**

**Act 2 flows without cuts: the calorie thread dissolves as the camera smoothly glides to the authentic Claude sidebar. The cursor hovers over the `+ New` button and clicks it. The camera returns to center on a fresh, clean prompt box with top tabs ("Chat" / "Cowork"). The cursor clicks the `(+)` button at the bottom left, rotating it 45°, which reveals the authentic Claude dropdown menu (Add files, Take a screenshot, Add to project, Skills, Create image, Web search). The cursor clicks "Create image", and stepped typing inputs: "Create an image of a blue sky", followed by clicking send. During synthesis, the camera sweeps into a focused 2.5D perspective tilt as the card generates with an active shimmering sweep and glowing pulse, with Claude's docked Thinking State pill cycling verbs ("Creating image..." → "Imagining vast blue sky..."). At 14.5s, the card and camera level out completely flat to 0° as the photorealistic 8K Blue Sky blooms into full clarity with Claude's response headline and metadata footer.**

**Act 3 introduces Claude Mobile (15.0s – 18.2s): A floating smartphone enters in 2.5D perspective showing the Claude Mobile app with Dynamic Island, iOS status bar, and user prompt. Instant cross-device synchronization reveals the identical photorealistic Blue Sky generation on mobile with a tactile spring bloom.**

**The Grand Climax (18.2s – 21.0s) transitions seamlessly: the mobile phone gracefully contracts into the central spark as the camera executes a single continuous monotonic pull-back to dead center. "Claude is" enters with luminous presence, and at that exact instant, "everywhere." in radiant terracotta #e0683b slides up from below with spring overshoot bounce to complete the sentence: ✳ Claude is everywhere.**

---

## Visual Staging & Components

1. **Authentic Claude Sidebar (Screenshot Reference 3)**: Full-featured 260px wide dark charcoal sidebar with serif `Claude` brand, `+ New` rounded button, navigation items (Projects, Artifacts, Code with `Upgrade` badge, Customize), pinned projects section, chats and tasks list with `○` bullets, and bottom profile row (`PS` avatar, `Prom · Free ∨`, download, search, and collapse icons).
2. **Atmospheric Dark Canvas**: Deep black canvas (`#0a0807`) with radiant terracotta ember glow radiating from the center. The ambient glow is nested inside `cl-camera-world` so it scales optically with the camera lens.
3. **Big Claude Prompt Box**: Large frosted glass container (`880px × 210px`, `border-radius: 22px`) with top tabs (`Chat`, `Cowork`), bottom attachment `(+)` button, model badge, and terracotta send button.
4. **Continuous Traveling Border Light Beam**: High-voltage SVG stroke rectangle along the perimeter (`strokeDasharray: 380 1764`) that activates upon image drop and **continuously traces around the box slowly and smoothly without disappearing**.
5. **Clean Single-Image Docking**: Big 72px × 72px rounded thumbnail (`border-radius: 14px`) with close button, solid `#1e1b18` dark backing, crisp shadow, and zero duplicate or blurred background layers.
6. **Buttery Smooth Camera Push-in (1.5s gentle power2.inOut curve)**: The camera begins pushing in as the image is being dragged, arriving smoothly at dead-center left framing (`scale: 2.15, x: 820, y: -20`) right as the image docks—completely eliminating abrupt snaps.
7. **Close-Framed Response View (Screenshot Reference 4)**: Camera pulls back only to `scale: 1.35, x: 80, y: -30` to keep the response and artifact card large, readable, and prominently centered, with itemized calorie breakdown lines (380 kcal, 120 kcal, 90 kcal, total ~590 kcal).
8. **Floating Bottom Chat Bar**: Floating rounded capsule bar (`+ Write a message...`, mic icon, Sonnet 4.6, and disclaimer) positioned cleanly beneath the conversation.
9. **Authentic Plus Dropdown Menu (Screenshot Reference 5)**: Emerges from the `(+)` button with `Add files or photos Ctrl U`, `Take a screenshot`, `Add to project >`, `Skills >`, `Create image` (highlighted), and `Web search ✓`.
10. **Claude Thinking State Pill**: Frosted rounded pill with Anthropic spark and dynamic cycling verbs reflecting active generation docked in Claude's response header.
11. **Photorealistic 8K Blue Sky Image Card with 2.5D Tilt & Level Settle**: Generates with 2.5D focus tilt, then levels back flat (0° rotation) with silky ease when complete.
12. **Claude Mobile Showcase**: Floating iPhone in 2.5D perspective demonstrating instant cross-device continuity with the generated Blue Sky visual.
13. **Grand Climax Monotonic Zoom & Radiant Finish**:
   - Single continuous camera pull-back from mobile framing to dead center `scale: 1.0, x: 0, y: 0`.
   - Giant-to-Settle Kinetic Zoom on `"✳ Claude is"`.
   - `"everywhere."` in vibrant terracotta `#e0683b` slides up from below with spring bounce (`ease: "back.out(1.4)"`) to finish the statement: **`✳ Claude is everywhere.`**.

---

## Detailed Narrative Timeline (21.0s)

| Time Window | Scene / Beat | Visual Choreography & Camera Motion |
| :--- | :--- | :--- |
| **0.0s – 1.4s** | **Scene 1: UI Construction** | Terracotta ambient ember bloom powers on; authentic 260px Claude sidebar slides in from left; spark ✳ spins into place; *"Good Morning, Sou"* rises; Big Prompt Box settles into place. |
| **1.4s – 2.9s** | **Scene 1: Smooth Push-In & Clean Image Drop** | Cursor drags clean ramen image. Camera initiates a **gentle 1.5s push-in** (`scale: 2.15, x: 820, y: -20`, `power2.inOut`). At 2.45s, cursor releases; image docks cleanly into 72px slot. Placeholder disappears. |
| **2.48s – 5.4s** | **Scene 1: Continuous Traveling Glow Beam** | Glowing border beam fades in and **continuously moves slowly and smoothly around the box perimeter without disappearing**. Camera holds for 0.5s pause. |
| **3.3s – 4.75s** | **Scene 1: Typing & Follow Pan** | Stepped typewriter reveals *"How many calories are in this ramen meal?"* while camera smoothly pans rightward (`x: 320`). |
| **4.75s – 5.4s** | **Scene 1: Send Click** | Camera pans to center orange send button (`scale: 2.3, x: -960, y: -240`). Cursor clicks; button squashes and glows. |
| **5.4s – 7.8s** | **Scene 1: Response View (Close Framing & Chat Bar Below)** | Camera pulls back to **close framing** (`scale: 1.35, x: 80, y: -30`). Calorie reply ascends; artifact card rises; itemized calorie breakdown lines expand (~590 kcal); floating bottom chat bar appears beneath. |
| **7.8s – 9.6s** | **Scene 2: Sidebar & "+ New" Click** | Calorie thread dissolves. Camera glides to sidebar (`scale: 1.25, x: 500, y: 120`). Cursor sweeps to `+ New` button and clicks it. |
| **9.6s – 11.85s** | **Scene 2: Fresh Prompt Box, (+) & "Create image"** | Fresh clean prompt box mounts cleanly. Camera centers on bottom-left (`scale: 1.45, x: 380, y: -60`). Cursor clicks `(+)`; button rotates 45°. Authentic dropdown opens; cursor clicks "Create image". |
| **11.85s – 13.5s** | **Scene 2: "Create an image of a blue sky"** | Placeholder disappears. Stepped typing reveals *"Create an image of a blue sky"*. Camera pans to send button; cursor clicks send at 13.35s. |
| **13.5s – 14.5s** | **Scene 2: Standalone Centered Synthesis** | Sidebar & connected canvas dissolve completely. Camera centers dead-center (`scale: 1.30, x: 0, y: -15`). Standalone thinking pill prominently cycles verbs in center (*"Thinking..."* → *"Generating..."* → *"Imagining vast blue sky..."* → *"Refining atmospheric lighting..."*) as card synthesizes with 2.5D tilt. |
| **14.5s – 15.0s** | **Scene 2: Flat Settle & 8K Blue Sky Reveal** | Card & camera smoothly level flat to 0° ("properly put it back"). Photorealistic 8K Blue Sky blooms into full clarity with response headline and card footer. |
| **15.0s – 18.2s** | **Scene 3: Claude Mobile Showcase (Deep Zoom & Interaction)** | Desktop recedes. Floating smartphone enters in 2.5D perspective. Massive camera zoom-in (`scale: 1.62 -> 1.82`) on mobile screen. Synced 8K card blooms. Cursor taps mobile composer, types *"Explain the atmospheric lighting here"*, and clicks send. Message bubble pops into mobile feed before climax. |
| **18.2s – 21.0s** | **Scene 4: Grand Climax — "✳ Claude is everywhere."** | Phone contracts into central spark; camera pulls back monotonically to dead center (`scale: 1.0, x: 0, y: 0`). Giant-to-Settle kinetic zoom on *"✳ Claude is"*, and *"everywhere."* slides up in radiant terracotta `#e0683b` with spring overshoot bounce. Hold through 21.0s. |
