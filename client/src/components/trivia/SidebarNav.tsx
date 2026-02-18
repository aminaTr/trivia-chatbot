import type React from "react";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
export function SidebarNav({
  started,
  startedRef,
  startTrivia,
  startMic,
  setStarted,
  setSessionStatus,
  category,
  setCategory,
  difficulty,
  setDifficulty,
  voice,
  setVoice,
  categories,
  categoryOpen,
  setCategoryOpen,
  difficultyOpen,
  setDifficultyOpen,
  settingsOpen,
  setSettingsOpen,
}: {
  started: boolean;
  startedRef: React.RefObject<boolean>;
  startTrivia: Function;
  startMic: Function;
  setStarted: Function;
  setSessionStatus: Function;
  category: string;
  setCategory: Function;
  difficulty: string;
  setDifficulty: Function;
  voice: string;
  setVoice: Function;
  categories: string[];
  categoryOpen: boolean;
  setCategoryOpen: (open: boolean) => void;
  difficultyOpen: boolean;
  setDifficultyOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}) {
  return (
    <nav className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Navigation
      </h2>

      {/* Start Trivia */}
      <Button
        variant="ghost"
        onClick={() => {
          if (startedRef.current) return;
          startTrivia(
            startMic,
            startedRef,
            setStarted,
            setSessionStatus,
            difficulty,
            category,
            voice,
          );
        }}
        className={`w-full justify-start ${started ? "bg-primary/65" : ""}`}
      >
        🧠 Start Trivia
      </Button>

      {/* Categories */}
      <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start">
            📚 Categories
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="ml-6 mt-2">
          <ul className="space-y-1 text-sm">
            {categories.map((cat) => (
              <li
                key={cat}
                onClick={() => {
                  if (started)
                    return toast.error("Stop playing trivia to reset category");
                  setCategory(cat);
                }}
                className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded-md transition-colors
                ${
                  category === cat
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    category === cat ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
                {cat}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Difficulty */}
      <Collapsible open={difficultyOpen} onOpenChange={setDifficultyOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start">
            🎚 Difficulty
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="ml-6 mt-2">
          <ul className="space-y-1 text-sm">
            {["easy", "medium", "hard"].map((level) => (
              <li
                key={level}
                onClick={() => {
                  if (started)
                    return toast.error(
                      "Stop playing trivia to reset difficulty level",
                    );
                  setDifficulty(level);
                }}
                className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded-md transition-colors
                ${
                  difficulty === level
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    difficulty === level ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
                {level}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Voice Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start">
            ⚙️ Voice Settings
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="ml-6 mt-2">
          <ul className="space-y-1 text-sm">
            {["astra", "arcade", "celeste", "eliphas"].map((v) => (
              <li
                key={v}
                onClick={() => {
                  if (started)
                    return toast.error("Stop playing trivia to reset voice");
                  setVoice(v);
                }}
                className={`cursor-pointer flex items-center gap-2 px-2 py-1 rounded-md transition-colors
                ${
                  voice === v
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    voice === v ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
                {v}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </nav>
  );
}
