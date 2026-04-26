import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/math-solve", async (req, res) => {
    try {
      const { model, problem, difficulty } = req.body;
      const prompt = `Solve this math problem and return ONLY the final numerical answer as a JSON object: { "answer": <number> }. Problem: ${problem}. You are operating at ${difficulty} difficulty. If EASY, you might occasionally make a small math error (-1 or +1). If HARD, answer perfectly and quickly.`;

      let answer = null;
      if (model === "Xylo") {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { 
             responseMimeType: "application/json",
             temperature: difficulty === "HARD" ? 0 : 0.8
          }
        });
        const result = JSON.parse(response.text || '{"answer": null}');
        answer = result.answer;
      } else if (model === "Nori") {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: difficulty === "HARD" ? 0 : 0.8
        });
        const result = JSON.parse(completion.choices[0].message.content || '{"answer": null}');
        answer = result.answer;
      }
      
      // Artificial delay so we don't return instantly for the first one every time, maybe?
      res.json({ answer });
    } catch (error) {
       console.error("Math API Error:", error);
       res.status(500).json({ error: "Failed to generate AI math answer" });
    }
  });

  app.post("/api/ai-move", async (req, res) => {
    try {
      const { model, board, mark, opponentMark, difficulty } = req.body;
      let move = -1;
      
      console.log("Gemini API key present?", !!process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY?.substring(0,6));
      
      let strategyData = "";
      try {
         strategyData = require('fs').readFileSync(path.join(process.cwd(), 'tic-tac-toe-strategy.txt'), 'utf-8');
      } catch (e) {
         console.warn("Could not read strategy data", e);
      }

      const prompt = `You are playing a game of Tic Tac Toe.
The board is represented as an array of 9 cells, where null means empty, and string means taken by a player mark.
Current Board: ${JSON.stringify(board)}
Your mark is: ${mark}
Opponent mark is: ${opponentMark}
Difficulty level: ${difficulty} (If easy, you can be suboptimal. If hard, play optimally to win or block).

--- TIC-TAC-TOE STRATEGY & RULES INFO ---
${strategyData}
--- END STRATEGY INFO ---

Based on the strategic information above, choose your next action.
Respond with ONLY the JSON object { "move": <index> } where index is a number between 0 and 8 for your chosen move.`;

      if (model === "Xylo" || model === "gemini") {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: difficulty === "HARD" ? 0.1 : 0.7,
          }
        });
        const result = JSON.parse(response.text || '{"move": -1}');
        move = result.move;
      } else if (model === "Nori" || model === "openai") {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: difficulty === "HARD" ? 0.1 : 0.7,
        });
        const result = JSON.parse(completion.choices[0].message.content || '{"move": -1}');
        move = result.move;
      }

      // fallback simple validation
      if (move === undefined || move < 0 || move > 8 || board[move] !== null) {
          move = board.indexOf(null);
      }

      res.json({ move });
    } catch (error) {
      console.error("Error with AI move generation:", error);
      res.status(500).json({ error: "Failed to generate AI move" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
