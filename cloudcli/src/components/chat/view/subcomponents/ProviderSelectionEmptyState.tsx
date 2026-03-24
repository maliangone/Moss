import React from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import SessionProviderLogo from "../../../llm-logo-provider/SessionProviderLogo";
import {
  CLAUDE_MODELS,
  CURSOR_MODELS,
  CODEX_MODELS,
  GEMINI_MODELS,
} from "../../../../../shared/modelConstants";
import type { ProjectSession, SessionProvider } from "../../../../types/app";
import { NextTaskBanner } from "../../../task-master";

type ProviderSelectionEmptyStateProps = {
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  provider: SessionProvider;
  setProvider: (next: SessionProvider) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  claudeModel: string;
  setClaudeModel: (model: string) => void;
  cursorModel: string;
  setCursorModel: (model: string) => void;
  codexModel: string;
  setCodexModel: (model: string) => void;
  geminiModel: string;
  setGeminiModel: (model: string) => void;
  tasksEnabled: boolean;
  isTaskMasterInstalled: boolean | null;
  onShowAllTasks?: (() => void) | null;
  setInput: React.Dispatch<React.SetStateAction<string>>;
};

type ProviderDef = {
  id: SessionProvider;
  name: string;
  infoKey: string;
  accent: string;
  ring: string;
  check: string;
};

// Moss: Only expose Claude provider for enterprise deployment
const PROVIDERS: ProviderDef[] = [
  {
    id: "claude",
    name: "Moss AI",
    infoKey: "providerSelection.providerInfo.anthropic",
    accent: "border-primary",
    ring: "ring-primary/15",
    check: "bg-primary text-primary-foreground",
  },
];

function getModelConfig(p: SessionProvider) {
  if (p === "claude") return CLAUDE_MODELS;
  if (p === "codex") return CODEX_MODELS;
  if (p === "gemini") return GEMINI_MODELS;
  return CURSOR_MODELS;
}

function getModelValue(
  p: SessionProvider,
  c: string,
  cu: string,
  co: string,
  g: string,
) {
  if (p === "claude") return c;
  if (p === "codex") return co;
  if (p === "gemini") return g;
  return cu;
}

export default function ProviderSelectionEmptyState({
  selectedSession,
  currentSessionId,
  provider,
  setProvider,
  textareaRef,
  claudeModel,
  setClaudeModel,
  cursorModel,
  setCursorModel,
  codexModel,
  setCodexModel,
  geminiModel,
  setGeminiModel,
  tasksEnabled,
  isTaskMasterInstalled,
  onShowAllTasks,
  setInput,
}: ProviderSelectionEmptyStateProps) {
  const { t } = useTranslation("chat");
  const nextTaskPrompt = t("tasks.nextTaskPrompt", {
    defaultValue: "Start the next task",
  });

  const selectProvider = (next: SessionProvider) => {
    setProvider(next);
    localStorage.setItem("selected-provider", next);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleModelChange = (value: string) => {
    if (provider === "claude") {
      setClaudeModel(value);
      localStorage.setItem("claude-model", value);
    } else if (provider === "codex") {
      setCodexModel(value);
      localStorage.setItem("codex-model", value);
    } else if (provider === "gemini") {
      setGeminiModel(value);
      localStorage.setItem("gemini-model", value);
    } else {
      setCursorModel(value);
      localStorage.setItem("cursor-model", value);
    }
  };

  const modelConfig = getModelConfig(provider);
  const currentModel = getModelValue(
    provider,
    claudeModel,
    cursorModel,
    codexModel,
    geminiModel,
  );

  /* ── New session — Moss: auto-select Claude, show welcome page ── */
  if (!selectedSession && !currentSessionId) {
    // Auto-select Claude provider on mount if not already set
    if (provider !== "claude") {
      selectProvider("claude");
    }

    const cards = [
      {
        key: "analyze" as const,
        icon: "📊",
        title: t("welcome.cards.analyze.title"),
        desc: t("welcome.cards.analyze.desc"),
        prompt: t("welcome.cardPrompts.analyze"),
      },
      {
        key: "predict" as const,
        icon: "📈",
        title: t("welcome.cards.predict.title"),
        desc: t("welcome.cards.predict.desc"),
        prompt: t("welcome.cardPrompts.predict"),
      },
      {
        key: "report" as const,
        icon: "📋",
        title: t("welcome.cards.report.title"),
        desc: t("welcome.cards.report.desc"),
        prompt: t("welcome.cardPrompts.report"),
      },
      {
        key: "documents" as const,
        icon: "🔧",
        title: t("welcome.cards.documents.title"),
        desc: t("welcome.cards.documents.desc"),
        prompt: t("welcome.cardPrompts.documents"),
      },
    ];

    const handleCardClick = (prompt: string) => {
      setInput(prompt);
      setTimeout(() => textareaRef.current?.focus(), 100);
    };

    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Greeting */}
          <div className="mb-8 text-center">
            <div className="mb-3 text-4xl">🤖</div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {t("welcome.greeting")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("welcome.subtitle")}
            </p>
          </div>

          {/* Quick-start cards — 2×2 grid */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <button
                key={card.key}
                onClick={() => handleCardClick(card.prompt)}
                className="flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="mb-2 text-2xl">{card.icon}</div>
                <div className="font-medium text-foreground">{card.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {card.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Example prompt hint */}
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium">{t("welcome.exampleHint")}</span>
            <br />
            <span className="mt-1 block italic">
              &ldquo;{t("welcome.examplePrompt")}&rdquo;
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ── Existing session — continue prompt ── */
  if (selectedSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md px-6 text-center">
          <p className="mb-1.5 text-lg font-semibold text-foreground">
            {t("session.continue.title")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("session.continue.description")}
          </p>

          {tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
