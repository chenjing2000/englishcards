if (!args.Contains("--a1")) throw new ArgumentException("Run the current reader checks with --a1. Article editor checks are historical and not executed.");
await ReaderChecks.RunAsync();
