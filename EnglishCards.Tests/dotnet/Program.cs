if (!args.Contains("--a1") && !args.Contains("--a2")) throw new ArgumentException("Run reader checks with --a1 or --a2.");
await ReaderChecks.RunAsync();
