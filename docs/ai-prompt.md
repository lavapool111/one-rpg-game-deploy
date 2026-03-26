# AI Context Prompt

*This document is a prompt designed to give other AI models (such as Gemini 3 Flash or Claude 4.6) full context of this game to assist in development or content creation.*

---

**PROMPT:**

Please implement the following features.

### World & Tone
The game takes place in an endless, shifting megadungeon called the "Band Room" and its subterranean "Backstage Halls." The tone is atmospheric, mysterious, and immersive, blending grand concert hall aesthetics with a sense of peril. There is no final endgame; it is an endless loop of progression.

### Core Systems
1. **Combat**: Musical instruments (Trumpets, Trombones, Tubas, etc.) serve as weapons. Attacks are themed around music theory (e.g., "Long Tone", "Sustained Bow").
2. **Enemies**: The primary antagonists are sentient, "rogue" brass instruments like the Tuba, French Horn, and Euphonium. They spawn in waves and scale in difficulty.
3. **Progression**: 
   - **Levels**: Players gain experience and level up.
   - **Ability Paths**: At level 30, players choose between paths like "Crits," "Brute Force," or "Poison."
   - **Inventory**: A deep crafting/enhancement system using instrumental components (Reeds of varying strength, Valve Oil, Cork Grease, Brass Ingots).
4. **Dungeon Tiers**: Run performance is ranked by musical dynamics, from *Pianissimo* (failed/poor) to *Fortissimo Possibile* (masterful).

### Technical Structure
- Built with **Next.js**, **React Three Fiber and Drei**, and **Zustand**. And Three.js.
- Uses a modular component system (`components/enemies`, `components/game`, `components/backstage-halls`).
- Game logic is centralized in `lib/game`, managing stats, inventory, and collision.