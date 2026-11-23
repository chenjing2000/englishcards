if (!args.Contains("--a1") && !args.Contains("--a2") && !args.Contains("--a3")) throw new ArgumentException("Run reader checks with --a1, --a2 or --a3.");
await ReaderChecks.RunAsync();
if (args.Contains("--a3")) await A3ReaderChecks.RunAsync();
