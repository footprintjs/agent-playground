import * as agent from 'agentfootprint';
import { mock, createProvider, anthropic, openai, ollama, bedrock, gatedTools, MockProvider } from 'agentfootprint/providers';
import { defineInstruction, defineSkill, defineSteering, defineFact } from 'agentfootprint/context';
import { defineMemory, InMemoryStore } from 'agentfootprint/memory';
import { SSEFormatter, LoggingDomains, runStepRecorder } from 'agentfootprint/observe';
import { fallbackProvider, withRetry, withFallback } from 'agentfootprint/resilience';
import * as foottrace from 'foottrace';
import * as write from 'foottrace/write';
import * as paths from 'foottrace/paths';

// Back the executor's existing explicit AgentFootprint name allowlist with
// the names' current public owners. This does not resolve arbitrary imports.
export const agentModules = {
  ...agent, mock, createProvider, anthropic, openai, ollama, bedrock, gatedTools, MockProvider,
  defineInstruction, defineSkill, defineSteering, defineFact, defineMemory, InMemoryStore,
  SSEFormatter, LoggingDomains, runStepRecorder, fallbackProvider, withRetry, withFallback,
};

// The record has exactly three public doors. Unlike the agent sample allowlist,
// the record playground deliberately exposes each entire official namespace.
export const recordModules = { ...foottrace, ...write, ...paths };
