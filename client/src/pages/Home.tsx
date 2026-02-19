import { Button } from "@/components/ui/button";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

import TriviaBot from "@/components/trivia/TriviaBot";
import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getCategories } from "@/api/home";
import socket from "@/api/socket";
import { useMicSetup } from "@/components/trivia/MicSetup";
import { startTrivia } from "@/components/trivia/StartTrivia";
import { SidebarNav } from "@/components/trivia/SidebarNav";

const Home = () => {
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] = useState("easy");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const isListeningRef = useRef<boolean>(false);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "active" | "completed"
  >("idle");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [voice, setVoice] = useState("astra");

  const { startMic, stopMic, resumeMic } = useMicSetup(isListeningRef, socket);

  useEffect(() => {
    // Reset started state when difficulty or category changes
    startedRef.current = false;
    setStarted(false);
  }, [difficulty, category]);

  useEffect(() => {
    const fetchCategories = async () => {
      const categories = await getCategories();
      setCategories(categories);
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      // Check if "General Knowledge" exists, else fallback to first category
      const generalCat =
        categories.find((c) => c.toLowerCase().includes("general")) ||
        categories[0];

      setCategory(generalCat);
    }
  }, [categories]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ================= TOP NAVBAR ================= */}
      <header className="w-full sticky top-0 z-50 border-b bg-background">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">
            🎯 Trivia Chatbot
          </h1>
          {/* ===== Filters ===== */}
          <div className="md:flex w-fit flex-col sm:flex-row sm:gap-3 gap-2 hidden ">
            {/* Difficulty */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:w-1/2 gap-2">
              <Label className="whitespace-nowrap text-sm sm:text-base truncate">
                Difficulty
              </Label>
              <Select
                value={difficulty}
                onValueChange={setDifficulty}
                disabled={started}
              >
                <SelectTrigger className="w-full sm:flex-1 text-sm">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Category */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label
                htmlFor="category"
                className="whitespace-nowrap text-sm sm:text-base"
              >
                Category
              </Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={started}
              >
                <SelectTrigger className="w-50 text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-w-75">
                  {categories.map((cat, index) => (
                    <SelectItem
                      key={`${cat}-${index}`}
                      value={cat}
                      className="whitespace-normal wrap-break-word"
                    >
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>{" "}
          </div>
          {/* Profile / Auth placeholder */}
          {/* <div className="flex items-center gap-3">
            <Button variant="outline">Login</Button>

            <Avatar>
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </div> */}
        </div>
      </header>

      {/* ================= MAIN BODY ================= */}
      <div className="flex flex-1 relative">
        {/* ---------- SIDEBAR NAV ---------- */}
        <aside className="sticky top-15 h-96 w-64 border-r p-4 hidden md:block">
          <SidebarNav
            started={started}
            startedRef={startedRef}
            startTrivia={startTrivia}
            startMic={startMic}
            setStarted={setStarted}
            setSessionStatus={setSessionStatus}
            category={category}
            setCategory={setCategory}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            voice={voice}
            setVoice={setVoice}
            categories={categories}
            categoryOpen={categoryOpen}
            setCategoryOpen={setCategoryOpen}
            difficultyOpen={difficultyOpen}
            setDifficultyOpen={setDifficultyOpen}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
          />
        </aside>

        {/* ---------- MAIN CONTENT ---------- */}
        <main className="flex-1 p-3 ">
          {/* Mobile Sidebar Button */}
          <div className="md:hidden p-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  ☰ Menu
                </Button>
              </DialogTrigger>

              <DialogContent className="w-72 p-4">
                <DialogHeader>
                  <DialogTitle>Navigation</DialogTitle>
                  <DialogDescription>
                    Choose trivia settings and start your session.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                  <SidebarNav
                    started={started}
                    startedRef={startedRef}
                    startTrivia={startTrivia}
                    startMic={startMic}
                    setStarted={setStarted}
                    setSessionStatus={setSessionStatus}
                    category={category}
                    setCategory={setCategory}
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    voice={voice}
                    setVoice={setVoice}
                    categories={categories}
                    categoryOpen={categoryOpen}
                    setCategoryOpen={setCategoryOpen}
                    difficultyOpen={difficultyOpen}
                    setDifficultyOpen={setDifficultyOpen}
                    settingsOpen={settingsOpen}
                    setSettingsOpen={setSettingsOpen}
                  />
                </div>

                <DialogClose asChild>
                  <Button variant="outline" className="mt-4 w-full">
                    Close
                  </Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
          </div>

          {/* <div
            className={`grid grid-cols-1 ${started ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-3 h-full`}
          > */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 h-full`}>
            {/* ======= TRIVIA CHAT CONTAINER (MIDDLE) ======= */}
            <div className="lg:col-span-2 flex flex-col">
              <Card className="flex-1 p-4">
                <h2 className="text-lg font-semibold  ">Trivia Chat</h2>

                {/* ===== Filters ===== */}
                <div className="flex flex-col sm:flex-row sm:gap-3 gap-2 md:hidden">
                  {/* Difficulty */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:w-1/2 gap-2">
                    <Label className="whitespace-nowrap text-sm sm:text-base truncate">
                      Difficulty
                    </Label>
                    <Select
                      value={difficulty}
                      onValueChange={setDifficulty}
                      disabled={started}
                    >
                      <SelectTrigger className="w-full sm:flex-1 text-sm">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:w-1/2 gap-2">
                    <Label
                      htmlFor="category"
                      className="whitespace-nowrap text-sm sm:text-base truncate"
                    >
                      Category
                    </Label>
                    <Select
                      value={category}
                      onValueChange={setCategory}
                      disabled={started}
                    >
                      <SelectTrigger className="w-full sm:flex-1 text-sm">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat, index) => (
                          <SelectItem
                            key={`${cat}-${index}`}
                            value={cat}
                            className="truncate"
                          >
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator className="mb-4" />

                {/* ===== Trivia Bot ===== */}
                <div className=" text-muted-foreground">
                  <TriviaBot
                    startedRef={startedRef}
                    started={started}
                    setStarted={setStarted}
                    difficulty={difficulty}
                    category={category}
                    voice={voice}
                    startMic={startMic}
                    stopMic={stopMic}
                    resumeMic={resumeMic}
                    sessionStatus={sessionStatus}
                    setSessionStatus={setSessionStatus}
                    isListeningRef={isListeningRef}
                  />
                </div>
              </Card>
            </div>

            {/* Left / Info Section */}
            {/* <div className={`lg:col-span-1 space-y-4 hidden}`}>
              <Card className="p-4">
                <h3 className="font-semibold mb-2">How it works</h3>
                <p className="text-sm text-muted-foreground">
                  Ask trivia questions using voice or text. Request hints
                  anytime. Earn points for correct answers.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Your Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Login to track score, history, and streaks.
                </p>
              </Card>
            </div> */}
          </div>
        </main>
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="border-t px-6 py-4 text-sm text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>© 2026 Trivia Chatbot</span>
          <span>Built with React & shadcn/ui</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
