interface Props {
  score: number;
}

export default function ScoreBoard({ score }: Props) {
  return (
    <div className="mb-4">
      <strong>Score:</strong> {score}
    </div>
  );
}
