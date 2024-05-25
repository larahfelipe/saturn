package util

import (
	"os"
	"os/signal"
	"syscall"
)

// Shutdown kills the program process.
func Shutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sigChan
}
