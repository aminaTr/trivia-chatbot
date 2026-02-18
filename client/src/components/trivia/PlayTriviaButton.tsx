import { Button } from "../ui/button";
export const PlayTriviaButton = ({
  text,
  category,
  onClick,
}: {
  text: string;
  category: string;
  onClick: () => Promise<void>;
}) => {
  return (
    <Button
      variant="outline"
      className="px-6 py-2 rounded-full"
      onClick={onClick}
      disabled={!category}
    >
      {!category ? "🔃 Loading...." : `▶️ ${text} `}
    </Button>
  );
};
