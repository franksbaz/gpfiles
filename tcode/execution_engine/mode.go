package main

import "os"

// ExecutionMode defines which portfolio/broker backend is active.
type ExecutionMode string

const (
	// ModeIBKRPaper routes execution to the IBKR paper-trading account via ib_insync.
	// This is the default live-paper mode.
	ModeIBKRPaper ExecutionMode = "IBKR_PAPER"

	// ModeIBKRLive routes execution to the real IBKR live account.
	// Requires explicit EXECUTION_MODE=IBKR_LIVE; all red-banner warnings apply.
	ModeIBKRLive ExecutionMode = "IBKR_LIVE"

	// ModeSimulation uses the internal PaperPortfolio only.
	// Intended exclusively for backtest replay and gastown-refinery runs.
	// /api/account returns an error in this mode; no broker connection is started.
	ModeSimulation ExecutionMode = "SIMULATION"
)

// ActiveExecutionMode is set once at startup from the EXECUTION_MODE env var.
// Default: ModeIBKRPaper.
var ActiveExecutionMode ExecutionMode = ModeIBKRPaper

// IBKRConnFailed is set true when the IBKR connection attempt fails at startup.
// In IBKR modes, new-trade submission is refused while this flag is true
// (no silent fallback to the internal simulator).
var IBKRConnFailed bool = false

// initExecutionMode reads EXECUTION_MODE from the environment and sets
// ActiveExecutionMode.  Unrecognised values default to IBKR_PAPER.
func initExecutionMode() {
	val := ExecutionMode(os.Getenv("EXECUTION_MODE"))
	switch val {
	case ModeIBKRPaper, ModeIBKRLive, ModeSimulation:
		ActiveExecutionMode = val
	default:
		ActiveExecutionMode = ModeIBKRPaper
	}
}
