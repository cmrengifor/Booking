export default function AccountLoading() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted/40" />
      <div className="h-32 w-full max-w-sm animate-pulse rounded-md bg-muted/40" />
      <div className="flex flex-col gap-2">
        <div className="h-6 w-32 animate-pulse rounded-md bg-muted/40" />
        <div className="h-16 w-full animate-pulse rounded-md bg-muted/40" />
        <div className="h-16 w-full animate-pulse rounded-md bg-muted/40" />
      </div>
    </div>
  );
}
