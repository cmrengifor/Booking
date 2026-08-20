import { Spinner } from "@/components/ui/spinner";

export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
