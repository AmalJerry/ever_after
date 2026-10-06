"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type SyntheticEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Asterisk,
  CakeSlice,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileHeart,
  Heart,
  ImagePlus,
  Images,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  Save,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api, ApiError, uploadMedia } from "@/lib/api";
import { demoExperience, emptyExperience, formatDate } from "@/lib/demo";
import {
  animationOptions,
  copyGroups,
  copyLimit,
  getPresentation,
  normalizeExperience,
  themeOptions,
} from "@/lib/presentation";
import type {
  Creator,
  ExperienceContent,
  ExperienceRecord,
  MediaAsset,
  Memory,
  JourneyCopy,
  JourneyMedia,
  PresentationSettings,
} from "@/lib/types";
import { ExperienceView } from "./experience-view";
import { Modal } from "./modal";

const steps = [
  {
    title: "The two of you",
    icon: Users,
    subtitle: "Every story starts with someone.",
  },
  {
    title: "Your memories",
    icon: Images,
    subtitle: "The little moments that became everything.",
  },
  {
    title: "A love letter",
    icon: Mail,
    subtitle: "Your words. Their favorite keepsake.",
  },
  {
    title: "Little details",
    icon: Settings2,
    subtitle: "A few things to make it theirs.",
  },
  {
    title: "Seal & share",
    icon: Send,
    subtitle: "A little piece of your heart, ready to send.",
  },
];

function Field({
  label,
  children,
  hint,
}: Readonly<{ label: string; children: ReactNode; hint?: string }>) {
  const labelId = useId();
  const hintId = useId();
  const controls = Children.map(children, (child) => {
    if (
      !isValidElement(child) ||
      !["input", "textarea", "select"].includes(String(child.type))
    )
      return child;
    return cloneElement(
      child as ReactElement<{
        "aria-labelledby"?: string;
        "aria-describedby"?: string;
      }>,
      {
        "aria-labelledby": labelId,
        "aria-describedby": hint ? hintId : undefined,
      },
    );
  });
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {controls}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}

function UploadButton({
  accept,
  label,
  disabled,
  onFile,
}: Readonly<{
  accept: string;
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}>) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="button button-secondary upload-button"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Upload size={15} />
        {label}
      </button>
    </>
  );
}

function AuthDialog({
  onClose,
  onSignedIn,
}: Readonly<{ onClose: () => void; onSignedIn: (user: Creator) => void }>) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const prefix = useId();

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api[mode](username, password);
      onSignedIn(response.user);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "We couldn't sign you in.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={mode === "register" ? "Your own little corner." : "Welcome back."}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="auth-tabs">
        <button
          aria-pressed={mode === "register"}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Create an account
        </button>
        <button
          aria-pressed={mode === "login"}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Sign in
        </button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <Field label="Username">
          <input
            id={`${prefix}-username`}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={150}
            disabled={busy}
          />
        </Field>
        <Field
          label="Password"
          hint={
            mode === "register"
              ? "At least 10 characters. Choose something unique."
              : undefined
          }
        >
          <input
            id={`${prefix}-password`}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "register" ? 10 : 1}
            maxLength={128}
            disabled={busy}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spinner" size={16} />
          ) : (
            <LockKeyhole size={16} />
          )}
          {mode === "register" ? "Create my account" : "Sign in"}
          <ArrowRight size={16} />
        </button>
        <p className="auth-privacy">
          <ShieldCheck size={14} /> Your stories stay private until you share
          them.
        </p>
      </form>
    </Modal>
  );
}

export function CreatorStudio() {
  const router = useRouter();
  const [draft, setDraft] = useState<ExperienceContent>(emptyExperience);
  const [record, setRecord] = useState<ExperienceRecord | null>(null);
  const [records, setRecords] = useState<ExperienceRecord[]>([]);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    JSON.stringify(emptyExperience()),
  );
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const presentation = getPresentation(draft);
  const dirty = JSON.stringify(draft) !== savedFingerprint;
  const live = Boolean(
    record?.shareToken &&
      record.expiresAt &&
      new Date(record.expiresAt) > new Date(),
  );
  const shareUrl =
    record?.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/experience/${record.shareToken}`
      : "";

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const session = await api.session();
        if (!active) return;
        setCreator(session.user);
        if (session.user) {
          const stories = await api.list();
          if (!active) return;
          setRecords(stories);
          if (stories.length) {
            setRecord(stories[0]);
            setDraft(stories[0].draft);
            setSavedFingerprint(JSON.stringify(stories[0].draft));
          }
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "The studio is unavailable.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirty || busy) event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, busy]);

  function change<FieldName extends keyof ExperienceContent>(
    field: FieldName,
    value: ExperienceContent[FieldName],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function changePresentation<FieldName extends keyof PresentationSettings>(
    field: FieldName,
    value: PresentationSettings[FieldName],
  ) {
    setDraft((current) => ({
      ...current,
      presentation: { ...getPresentation(current), [field]: value },
    }));
    setNotice("");
  }

  function changeCopy(field: keyof JourneyCopy, value: string) {
    changePresentation("copy", { ...presentation.copy, [field]: value });
  }

  function changeJourneyMedia(
    target: "celebrationMedia" | "finaleMedia",
    media: JourneyMedia,
  ) {
    changePresentation(target, media);
  }

  function moveChapter(index: number, offset: number) {
    const order = [...presentation.chapterOrder];
    [order[index], order[index + offset]] = [
      order[index + offset],
      order[index],
    ];
    changePresentation("chapterOrder", order);
  }

  function updateMemory(id: string, update: Partial<Memory>) {
    setDraft((current) => ({
      ...current,
      memories: current.memories.map((memory) =>
        memory.id === id ? { ...memory, ...update } : memory,
      ),
    }));
  }

  function moveMemory(index: number, offset: number) {
    const memories = [...draft.memories];
    const target = index + offset;
    [memories[index], memories[target]] = [memories[target], memories[index]];
    change("memories", memories);
  }

  function rememberRecord(updated: ExperienceRecord) {
    setRecord(updated);
    setRecords((current) => [
      updated,
      ...current.filter((item) => item.id !== updated.id),
    ]);
  }

  async function persist() {
    const snapshot = structuredClone(draft);
    const updated = record
      ? await api.save(record.id, snapshot)
      : await api.create(snapshot);
    rememberRecord(updated);
    const normalized = normalizeExperience(updated.draft);
    setDraft(normalized);
    setSavedFingerprint(JSON.stringify(normalized));
    return updated;
  }

  async function runTask(label: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Something went wrong. Please try again.",
      );
      if (failure instanceof ApiError && failure.status === 403)
        setAuthOpen(true);
    } finally {
      setBusy("");
    }
  }

  function requireAccount() {
    if (creator) return true;
    setAuthOpen(true);
    return false;
  }

  function save() {
    if (!requireAccount()) return;
    void runTask("save", async () => {
      await persist();
      setNotice("Your private draft is saved.");
    });
  }

  function publish() {
    if (!requireAccount()) return;
    if (!draft.recipientName.trim() || !draft.senderName.trim()) {
      setError("Add both of your names before publishing.");
      setStep(0);
      return;
    }
    void runTask("publish", async () => {
      const saved = await persist();
      rememberRecord(await api.publish(saved.id, expiresInDays));
      setNotice("Sealed with love. Your private link is ready.");
    });
  }

  function chooseStory(next: ExperienceRecord | null) {
    const action = () => {
      const content = next?.draft || emptyExperience();
      setRecord(next);
      setDraft(content);
      setSavedFingerprint(JSON.stringify(content));
      setStep(0);
      setError("");
      setNotice("");
    };
    if (dirty)
      setConfirmation({
        title: "Leave these little changes?",
        message:
          "Your unsaved changes will be discarded. Your saved and published stories will stay as they are.",
        action,
      });
    else action();
  }

  async function signedIn(user: Creator) {
    setCreator(user);
    setError("");
    setNotice("You're signed in. Your draft is ready to save.");
    try {
      setRecords(await api.list());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't load your saved stories.",
      );
    }
  }

  function handleUpload(file: File, target: "hero" | "audio" | string) {
    if (!requireAccount()) return;
    if (!rightsConfirmed) {
      setError(
        "Confirm you have permission to share this media before uploading.",
      );
      return;
    }
    const imageOnly = ["hero", "celebrationMedia", "finaleMedia"].includes(
      target,
    );
    const kind: MediaAsset["kind"] =
      target === "audio"
        ? "audio"
        : file.type.startsWith("video/") && !imageOnly
          ? "video"
          : "image";
    const limits = { image: 10, video: 50, audio: 15 };
    if (file.size > limits[kind] * 1024 * 1024) {
      setError(`Choose a ${kind} smaller than ${limits[kind]} MB.`);
      return;
    }
    setProgress(0);
    void runTask("upload", async () => {
      const saved = await persist();
      const asset = await uploadMedia(saved.id, file, kind, setProgress);
      if (target === "hero") change("heroImage", asset.url);
      else if (target === "audio") change("audioUrl", asset.url);
      else if (target === "celebrationMedia" || target === "finaleMedia") {
        changeJourneyMedia(target, {
          url: asset.url,
          stillUrl: asset.stillUrl || asset.url,
          alt: presentation[target].alt,
        });
      } else
        updateMemory(target, {
          url: asset.url,
          stillUrl: kind === "image" ? asset.stillUrl : "",
          kind: kind as Memory["kind"],
        });
      setNotice(
        "Upload complete. Save your draft to keep this media in your story.",
      );
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Private link copied.");
    } catch {
      setError(
        "Clipboard access isn't available. You can select and copy the link below.",
      );
    }
  }

  function revoke() {
    if (!record) return;
    setConfirmation({
      title: "Take this story back to private?",
      message:
        "The current share link will stop working immediately. Republishing will create a new link.",
      action: () => {
        void runTask("revoke", async () => {
          rememberRecord(await api.unpublish(record.id));
          setNotice("The link has been revoked. Your draft is still here.");
        });
      },
    });
  }

  function removeStory() {
    if (!record) return;
    setConfirmation({
      title: "Delete this birthday story?",
      message:
        "The draft, shared experience, and uploaded media will be permanently deleted. This cannot be undone.",
      action: () => {
        void runTask("delete", async () => {
          await api.remove(record.id);
          setRecords((current) =>
            current.filter((item) => item.id !== record.id),
          );
          const next = emptyExperience();
          setDraft(next);
          setRecord(null);
          setSavedFingerprint(JSON.stringify(next));
          setStep(0);
          setNotice("The story has been deleted.");
        });
      },
    });
  }

  function signOut() {
    const action = () => {
      void runTask("logout", async () => {
        await api.logout();
        const blank = emptyExperience();
        setCreator(null);
        setRecord(null);
        setRecords([]);
        setDraft(blank);
        setSavedFingerprint(JSON.stringify(blank));
        setStep(0);
        setNotice("You're signed out.");
      });
    };
    if (dirty)
      setConfirmation({
        title: "Sign out with unsaved changes?",
        message:
          "Your unsaved changes will be discarded. Saved stories will remain in your account.",
        action,
      });
    else action();
  }

  function guardExit(event: { preventDefault: () => void }) {
    if (!dirty && !busy) return;
    event.preventDefault();
    if (busy) {
      setNotice(
        "Finishing your current change. Your story will be ready in a moment.",
      );
      return;
    }
    setConfirmation({
      title: "Leave your story?",
      message:
        "Your unsaved changes will be discarded. Save your draft first to keep these little details.",
      action: () => router.push("/"),
    });
  }

  if (preview)
    return (
      <ExperienceView
        experience={draft}
        preview
        onExitPreview={() => {
          setPreview(false);
          window.scrollTo(0, 0);
        }}
      />
    );

  const rightsControl = (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={rightsConfirmed}
        onChange={(event) => setRightsConfirmed(event.target.checked)}
      />
      <span>
        I own or have permission to share the photos, videos, and music I
        upload.
      </span>
    </label>
  );

  return (
    <div className={`studio theme-${draft.theme}`}>
      <a className="skip-link" href="#studio-editor">
        Skip to editor
      </a>
      <header className="studio-header">
        <Link className="wordmark" href="/" onNavigate={guardExit}>
          ever<span>,</span> after<span className="wordmark-dot">.</span>
          <Asterisk size={19} className="brand-asterisk" />
        </Link>
        <span className="studio-header-label">
          <span /> THE LITTLE STORY STUDIO
        </span>
        <div className="studio-header-actions">
          {creator ? (
            <>
              <span className="creator-name">
                <UserRound size={14} />
                {creator.username}
              </span>
              <button
                className="icon-button"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                disabled={Boolean(busy)}
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button
              className="text-button"
              onClick={() => setAuthOpen(true)}
              disabled={loading}
            >
              <UserRound size={15} />
              Sign in
            </button>
          )}
          <Link
            className="icon-button"
            href="/"
            onNavigate={guardExit}
            aria-label="Back to the sample story"
            title="Back to sample story"
          >
            <X size={19} />
          </Link>
        </div>
      </header>
      <div className="studio-titlebar">
        <div>
          <span className="eyebrow">SOMETHING ONLY YOU COULD MAKE</span>
          <h1>
            Your story, <em>beautifully told.</em>
          </h1>
        </div>
        <div className="studio-top-actions">
          <span className="save-indicator">
            {loading ? (
              <LoaderCircle size={13} className="spinner" />
            ) : dirty || !record ? (
              <span className="unsaved-dot" />
            ) : (
              <Check size={14} />
            )}
            {loading
              ? "Opening studio"
              : dirty
                ? "Unsaved changes"
                : record
                  ? "All changes saved"
                  : "A fresh beginning"}
          </span>
          <button
            className="button button-secondary"
            onClick={() => {
              setPreview(true);
              window.scrollTo(0, 0);
            }}
            disabled={Boolean(busy) || loading}
          >
            <Eye size={16} />
            <span>Preview</span>
          </button>
          <button
            className="button button-primary"
            onClick={save}
            disabled={Boolean(busy) || loading}
          >
            {busy === "save" ? (
              <LoaderCircle className="spinner" size={16} />
            ) : (
              <Save size={16} />
            )}
            <span>Save draft</span>
          </button>
        </div>
      </div>
      {(error || notice) && (
        <div
          className={`studio-notice ${error ? "is-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error ? (
            <span>{error}</span>
          ) : (
            <>
              <CheckCircle2 size={15} />
              <span>{notice}</span>
            </>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss message"
            title="Dismiss"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy === "upload" && (
        <div className="upload-progress">
          <progress
            max={100}
            value={progress}
            aria-label="Media upload progress"
          />
          <span>
            {progress === 100
              ? "Finishing your private upload..."
              : `Uploading ${progress}%`}
          </span>
        </div>
      )}
      <div className="studio-workspace">
        <aside className="studio-sidebar">
          <nav aria-label="Creator sections">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  className={step === index ? "active" : ""}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => setStep(index)}
                >
                  <Icon size={17} />
                  <span>{item.title}</span>
                  <span className="step-count">0{index + 1}</span>
                </button>
              );
            })}
          </nav>
          <div className="studio-story-switch">
            <label htmlFor="saved-stories">YOUR STORIES</label>
            <select
              id="saved-stories"
              value={record?.id || ""}
              disabled={Boolean(busy) || loading}
              onChange={(event) =>
                chooseStory(
                  records.find((item) => item.id === event.target.value) ||
                    null,
                )
              }
            >
              <option value="">Unsaved story</option>
              {records.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.draft.recipientName || "Untitled birthday"}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => chooseStory(null)}
              disabled={Boolean(busy) || loading}
            >
              <Plus size={14} />
              New story
            </button>
          </div>
          <div className="studio-sidebar-note">
            <LockKeyhole size={15} />
            <span>
              Just you and your story.
              <br />
              Private until you say otherwise.
            </span>
          </div>
          <button
            className="text-button sample-button"
            disabled={Boolean(busy) || loading}
            onClick={() =>
              setConfirmation({
                title: "Start with our sample story?",
                message:
                  "This will open the Sophie and Alex sample as a new, unsaved story. Any unsaved edits in this editor will be replaced.",
                action: () => {
                  setDraft(structuredClone(demoExperience));
                  setRecord(null);
                  setSavedFingerprint("");
                  setStep(0);
                  setNotice("The sample is yours to make your own.");
                },
              })
            }
          >
            <Sparkles size={13} />
            Start with the sample
          </button>
        </aside>

        <main className="studio-editor" id="studio-editor">
          <div className="editor-heading">
            <span className="eyebrow">CHAPTER 0{step + 1} / 05</span>
            <h2>{steps[step].title}</h2>
            <p>{steps[step].subtitle}</p>
          </div>
          <fieldset
            className="editor-fields"
            disabled={Boolean(busy) || loading}
          >
            {step === 0 && (
              <div className="editor-section">
                <div className="field-row">
                  <Field label="Their name">
                    <input
                      value={draft.recipientName}
                      onChange={(event) =>
                        change("recipientName", event.target.value)
                      }
                      placeholder="Your favorite person"
                      maxLength={50}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Your name">
                    <input
                      value={draft.senderName}
                      onChange={(event) =>
                        change("senderName", event.target.value)
                      }
                      placeholder="The one behind the magic"
                      maxLength={50}
                      autoComplete="off"
                    />
                  </Field>
                </div>
                <Field label="Their birthday">
                  <input
                    type="date"
                    value={draft.birthday}
                    onChange={(event) => change("birthday", event.target.value)}
                    required
                  />
                </Field>
                <Field label="A little opening note">
                  <textarea
                    rows={2}
                    value={draft.subtitle}
                    onChange={(event) => change("subtitle", event.target.value)}
                    maxLength={200}
                    placeholder="Another trip around the sun. A million more reasons to love you."
                  />
                </Field>
                <fieldset className="theme-picker">
                  <legend>The atmosphere</legend>
                  <div className="theme-options">
                    {themeOptions.map((theme) => (
                      <label
                        className={`theme-option ${draft.theme === theme.id ? "selected" : ""}`}
                        key={theme.id}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={theme.id}
                          checked={draft.theme === theme.id}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              theme: theme.id,
                              presentation: {
                                ...getPresentation(current),
                                accentColor: theme.accent,
                              },
                            }))
                          }
                        />
                        <span className="theme-swatches">
                          {theme.colors.map((color) => (
                            <i key={color} style={{ background: color }} />
                          ))}
                        </span>
                        <span>{theme.name}</span>
                        {draft.theme === theme.id && <Check size={13} />}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Accent color">
                  <input
                    type="color"
                    value={presentation.accentColor}
                    onChange={(event) =>
                      changePresentation("accentColor", event.target.value)
                    }
                  />
                </Field>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={presentation.showBirthday}
                    onChange={(event) =>
                      changePresentation("showBirthday", event.target.checked)
                    }
                  />
                  <span>Show birthday date</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={presentation.showCover}
                    onChange={(event) =>
                      changePresentation("showCover", event.target.checked)
                    }
                  />
                  <span>Use cover photograph as the story background</span>
                </label>
                <div className="cover-picker">
                  <span className="field-title">
                    Story background photograph
                  </span>
                  <div className="cover-options">
                    {[
                      "/images/celebration.jpg",
                      "/images/hero.jpg",
                      "/images/coast.jpg",
                    ].map((url, index) => (
                      <button
                        className={draft.heroImage === url ? "selected" : ""}
                        key={url}
                        aria-label={`Choose ${["garden", "couple", "lakeside"][index]} cover`}
                        aria-pressed={draft.heroImage === url}
                        onClick={() => change("heroImage", url)}
                      >
                        <Image src={url} alt="" fill sizes="150px" />
                        {draft.heroImage === url && (
                          <span>
                            <Check size={15} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {rightsControl}
                  <UploadButton
                    label="Upload your photograph"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={Boolean(busy) || !rightsConfirmed}
                    onFile={(file) => handleUpload(file, "hero")}
                  />
                  <span className="field-hint">
                    JPEG, PNG or WebP. Up to 10 MB.
                  </span>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="editor-section">
                {rightsControl}
                {draft.memories.length === 0 && (
                  <div className="editor-empty">
                    <Images size={30} strokeWidth={1.2} />
                    <h3>A thousand little moments.</h3>
                    <p>Which one will you start with?</p>
                  </div>
                )}
                <div className="memory-edit-list">
                  {draft.memories.map((memory, index) => (
                    <div className="memory-edit-item" key={memory.id}>
                      <div className="memory-edit-header">
                        <span className="eyebrow">
                          MEMORY {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            aria-label={`Move memory ${index + 1} up`}
                            title="Move up"
                            disabled={index === 0}
                            onClick={() => moveMemory(index, -1)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Move memory ${index + 1} down`}
                            title="Move down"
                            disabled={index === draft.memories.length - 1}
                            onClick={() => moveMemory(index, 1)}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            className="icon-button danger-text"
                            aria-label={`Remove memory ${index + 1}`}
                            title="Remove memory"
                            onClick={() =>
                              change(
                                "memories",
                                draft.memories.filter(
                                  (item) => item.id !== memory.id,
                                ),
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="memory-edit-media">
                        {memory.url ? (
                          <div className="memory-edit-thumb">
                            {memory.kind === "video" ? (
                              <video
                                src={memory.url}
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <Image
                                src={memory.url}
                                alt={memory.title || "Memory preview"}
                                fill
                                sizes="100px"
                                unoptimized={memory.url.startsWith("/api/")}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="memory-edit-thumb empty">
                            <ImagePlus size={25} strokeWidth={1.2} />
                          </div>
                        )}
                        <div>
                          <UploadButton
                            label={
                              memory.url
                                ? "Replace photo or video"
                                : "Add photo or video"
                            }
                            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                            disabled={Boolean(busy) || !rightsConfirmed}
                            onFile={(file) => handleUpload(file, memory.id)}
                          />
                          <span className="field-hint">
                            Images up to 10 MB. MP4 or WebM up to 50 MB.
                          </span>
                        </div>
                      </div>
                      <div className="field-row">
                        <Field label={`Memory ${index + 1} title`}>
                          <input
                            value={memory.title}
                            onChange={(event) =>
                              updateMemory(memory.id, {
                                title: event.target.value,
                              })
                            }
                            maxLength={100}
                            placeholder="That one perfect day"
                          />
                        </Field>
                        <Field label={`Memory ${index + 1} date`}>
                          <input
                            type="date"
                            value={memory.date}
                            onChange={(event) =>
                              updateMemory(memory.id, {
                                date: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label={`Memory ${index + 1} caption`}>
                        <textarea
                          rows={3}
                          value={memory.caption}
                          onChange={(event) =>
                            updateMemory(memory.id, {
                              caption: event.target.value,
                            })
                          }
                          maxLength={2000}
                          placeholder="The part you never want to forget..."
                        />
                      </Field>
                    </div>
                  ))}
                </div>
                <button
                  className="button button-secondary add-memory"
                  disabled={draft.memories.length >= 20}
                  onClick={() =>
                    change("memories", [
                      ...draft.memories,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        caption: "",
                        date: "",
                        kind: "image",
                        url: "",
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  Add a memory<span>{draft.memories.length} / 20</span>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="editor-section">
                <Field label="The salutation">
                  <input
                    value={draft.letterTitle}
                    onChange={(event) =>
                      change("letterTitle", event.target.value)
                    }
                    placeholder="My favorite person,"
                    maxLength={100}
                  />
                </Field>
                <Field label="Your letter">
                  <textarea
                    className="letter-editor"
                    rows={13}
                    value={draft.letterBody}
                    onChange={(event) =>
                      change("letterBody", event.target.value)
                    }
                    placeholder="The things I don't say enough..."
                    maxLength={12000}
                  />
                  <small className="character-count">
                    {draft.letterBody.length.toLocaleString()} / 12,000
                  </small>
                </Field>
                <Field label="One last thought">
                  <textarea
                    rows={3}
                    value={draft.closingMessage}
                    onChange={(event) =>
                      change("closingMessage", event.target.value)
                    }
                    maxLength={300}
                    placeholder=""
                  />
                </Field>
                <span className="privacy-inline">
                  <FileHeart size={16} />
                  Entirely your words. Always.
                </span>
              </div>
            )}

            {step === 3 && (
              <div className="editor-section">
                <div className="editor-subheading">
                  <CakeSlice size={19} />
                  <h3>The birthday cake</h3>
                </div>
                <fieldset className="cake-color-picker">
                  <legend>Frosting</legend>
                  <div>
                    {(["rose", "vanilla", "sage"] as const).map((color) => (
                      <label key={color}>
                        <input
                          type="radio"
                          name="cakeColor"
                          checked={draft.cakeColor === color}
                          onChange={() => change("cakeColor", color)}
                        />
                        <span className={`frosting-swatch frosting-${color}`}>
                          {draft.cakeColor === color && <Check size={14} />}
                        </span>
                        <span>{color}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Candles">
                  <select
                    value={draft.candleCount}
                    onChange={(event) =>
                      change(
                        "candleCount",
                        Number(event.target.value) as 1 | 3 | 5,
                      )
                    }
                  >
                    <option value={1}>One little wish</option>
                    <option value={3}>Three wishes</option>
                    <option value={5}>A little extra magic</option>
                  </select>
                </Field>
                <Field
                  label="Microphone sensitivity"
                  hint="Higher sensitivity catches a gentler breath, but may also catch room noise. The tap fallback is always available."
                >
                  <div className="range-field">
                    <span>Less</span>
                    <input
                      aria-label="Microphone sensitivity"
                      type="range"
                      min={2}
                      max={20}
                      value={Math.round(
                        (0.22 - draft.microphoneSensitivity) * 100,
                      )}
                      onChange={(event) =>
                        change(
                          "microphoneSensitivity",
                          Number(
                            (0.22 - Number(event.target.value) / 100).toFixed(
                              2,
                            ),
                          ),
                        )
                      }
                    />
                    <span>More</span>
                  </div>
                </Field>
                <div className="editor-divider" />
                <div className="switch-row">
                  <div>
                    <h3>One more surprise</h3>
                    <span>
                      A question, a secret, a date to look forward to.
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable surprise"
                      checked={draft.surprise.enabled}
                      onChange={(event) =>
                        change("surprise", {
                          ...draft.surprise,
                          enabled: event.target.checked,
                        })
                      }
                    />
                    <span />
                  </label>
                </div>
                {draft.surprise.enabled && (
                  <>
                    <Field label="The question">
                      <textarea
                        rows={2}
                        value={draft.surprise.question}
                        onChange={(event) =>
                          change("surprise", {
                            ...draft.surprise,
                            question: event.target.value,
                          })
                        }
                        maxLength={300}
                        placeholder="Remember where we had our first coffee?"
                      />
                    </Field>
                    <Field label="The reveal">
                      <textarea
                        rows={3}
                        value={draft.surprise.answer}
                        onChange={(event) =>
                          change("surprise", {
                            ...draft.surprise,
                            answer: event.target.value,
                          })
                        }
                        maxLength={2000}
                        placeholder="We're going back. Saturday, 10 am. It's a date."
                      />
                    </Field>
                  </>
                )}
                <div className="editor-divider" />
                <div className="editor-subheading">
                  <Sparkles size={18} />
                  <h3>The soundtrack</h3>
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={presentation.musicEnabled}
                    onChange={(event) =>
                      changePresentation("musicEnabled", event.target.checked)
                    }
                  />
                  <span>Enable music</span>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={presentation.musicAutoplay}
                    disabled={!presentation.musicEnabled}
                    onChange={(event) =>
                      changePresentation("musicAutoplay", event.target.checked)
                    }
                  />
                  <span>Start music after candles go out</span>
                </label>
                <Field label="Starting music volume">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={presentation.musicVolume}
                    disabled={!presentation.musicEnabled}
                    onChange={(event) =>
                      changePresentation(
                        "musicVolume",
                        Number(event.target.value),
                      )
                    }
                  />
                  <small>{Math.round(presentation.musicVolume * 100)}%</small>
                </Field>
                <p className="field-hint">
                  {draft.audioUrl
                    ? "Your personal soundtrack is attached."
                    : "Birthday music box"}
                </p>
                {draft.audioUrl && (
                  <div className="attached-audio">
                    <audio controls src={draft.audioUrl} preload="none" />
                    <button
                      className="icon-button danger-text"
                      title="Remove audio"
                      aria-label="Remove uploaded audio"
                      onClick={() => change("audioUrl", "")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                {rightsControl}
                <UploadButton
                  label={
                    draft.audioUrl
                      ? "Replace soundtrack"
                      : "Upload your own music"
                  }
                  accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg"
                  disabled={Boolean(busy) || !rightsConfirmed}
                  onFile={(file) => handleUpload(file, "audio")}
                />
                <span className="field-hint">
                  MP3, WAV or Ogg. Up to 15 MB. Only music you own or are
                  licensed to share.
                </span>
                <div className="editor-divider" />
                <div className="editor-subheading">
                  <Settings2 size={18} />
                  <h3>Story screens</h3>
                </div>
                <div className="chapter-settings">
                  {(
                    [
                      ["celebration", "Celebration screen"],
                      ["heart", "3D heart screen"],
                      ["memories", "Memories screen"],
                      ["letter", "Letter screen"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="checkbox-field" key={key}>
                      <input
                        type="checkbox"
                        checked={presentation.chapters[key]}
                        onChange={(event) =>
                          changePresentation("chapters", {
                            ...presentation.chapters,
                            [key]: event.target.checked,
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={presentation.animationsEnabled}
                      onChange={(event) =>
                        changePresentation(
                          "animationsEnabled",
                          event.target.checked,
                        )
                      }
                    />
                    <span>Enable decorative animations</span>
                  </label>
                </div>
                <ol className="chapter-order" aria-label="Story screen order">
                  {presentation.chapterOrder.map((chapter, index) => (
                    <li key={chapter}>
                      <span>
                        {
                          {
                            celebration: "Celebration",
                            heart: "3D heart",
                            memories: "Memories",
                            letter: "Letter",
                          }[chapter]
                        }
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          title="Move earlier"
                          aria-label={`Move ${chapter} earlier`}
                          disabled={index === 0}
                          onClick={() => moveChapter(index, -1)}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          className="icon-button"
                          title="Move later"
                          aria-label={`Move ${chapter} later`}
                          disabled={
                            index === presentation.chapterOrder.length - 1
                          }
                          onClick={() => moveChapter(index, 1)}
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="editor-divider" />
                <div className="editor-subheading">
                  <Images size={18} />
                  <h3>Celebration artwork</h3>
                </div>
                {(
                  [
                    ["celebrationMedia", "Celebration"],
                    ["finaleMedia", "Final page"],
                  ] as const
                ).map(([target, label]) => (
                  <div className="journey-media-editor" key={target}>
                    <Field label={`${label} artwork`}>
                      <select
                        value={
                          animationOptions.some(
                            (option) =>
                              option.media.url === presentation[target].url,
                          )
                            ? presentation[target].url
                            : "custom"
                        }
                        onChange={(event) => {
                          const option = animationOptions.find(
                            (item) => item.media.url === event.target.value,
                          );
                          if (option)
                            changeJourneyMedia(target, { ...option.media });
                        }}
                      >
                        {animationOptions.map((option) => (
                          <option value={option.media.url} key={option.name}>
                            {option.name}
                          </option>
                        ))}
                        {!animationOptions.some(
                          (option) =>
                            option.media.url === presentation[target].url,
                        ) && (
                          <option value="custom">Your uploaded artwork</option>
                        )}
                      </select>
                    </Field>
                    <div className="journey-media-thumbnail">
                      <Image
                        src={
                          presentation[target].stillUrl ||
                          presentation[target].url
                        }
                        alt={presentation[target].alt}
                        fill
                        sizes="160px"
                        unoptimized
                      />
                    </div>
                    <Field label={`${label} image description`}>
                      <input
                        maxLength={200}
                        value={presentation[target].alt}
                        onChange={(event) =>
                          changeJourneyMedia(target, {
                            ...presentation[target],
                            alt: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <UploadButton
                      label={`Upload ${label.toLowerCase()} artwork`}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={Boolean(busy) || !rightsConfirmed}
                      onFile={(file) => handleUpload(file, target)}
                    />
                    <span className="field-hint">
                      JPEG, PNG, WebP or GIF. Up to 10 MB; animated images up to
                      120 frames.
                    </span>
                  </div>
                ))}
                <div className="editor-divider" />
                <div className="editor-subheading">
                  <FileHeart size={18} />
                  <h3>Screen wording</h3>
                </div>
                {copyGroups.map((group) => (
                  <details className="copy-settings" key={group.name}>
                    <summary>{group.name}</summary>
                    <div className="copy-settings-fields">
                      {group.fields.map(([key, label]) => (
                        <Field label={label} key={key}>
                          {key.endsWith("Heading") ||
                          key.endsWith("Message") ||
                          key.endsWith("Note") ? (
                            <textarea
                              rows={2}
                              value={presentation.copy[key]}
                              maxLength={copyLimit(key)}
                              onChange={(event) =>
                                changeCopy(key, event.target.value)
                              }
                            />
                          ) : (
                            <input
                              value={presentation.copy[key]}
                              maxLength={copyLimit(key)}
                              onChange={(event) =>
                                changeCopy(key, event.target.value)
                              }
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="editor-section">
                <div className="publish-summary">
                  <span className="publish-heart">
                    <Heart size={26} strokeWidth={1.2} />
                  </span>
                  <h3>A birthday, made personal.</h3>
                  <p>
                    For {draft.recipientName || "your favorite person"}, with
                    love from {draft.senderName || "you"}.
                  </p>
                  <ul>
                    <li>
                      <CheckCircle2 size={16} />
                      {draft.memories.length} little memories
                    </li>
                    <li>
                      <Mail size={16} />
                      {draft.letterBody
                        ? "A letter from the heart"
                        : "A quiet birthday dedication"}
                    </li>
                    <li>
                      <CakeSlice size={16} />
                      {draft.candleCount} birthday{" "}
                      {draft.candleCount === 1 ? "candle" : "candles"}
                    </li>
                    {draft.surprise.enabled && (
                      <li>
                        <Sparkles size={16} />
                        One lovely surprise
                      </li>
                    )}
                  </ul>
                </div>
                <Field label="Keep the link open for">
                  <select
                    value={expiresInDays}
                    onChange={(event) =>
                      setExpiresInDays(Number(event.target.value))
                    }
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </Field>
                <p className="privacy-inline">
                  <LockKeyhole size={17} />
                  <span>
                    Only people with your link can open this story. Share it
                    privately. You can revoke it at any time.
                  </span>
                </p>
                <button
                  className="button button-primary publish-button"
                  onClick={publish}
                >
                  {busy === "publish" ? (
                    <LoaderCircle size={16} className="spinner" />
                  ) : (
                    <Send size={16} />
                  )}
                  {live ? "Publish latest changes" : "Publish experience"}
                  <ArrowRight size={16} />
                </button>
                {record?.shareToken && (
                  <div className="share-result">
                    <span className="share-status">
                      <span className={live ? "live-dot" : "expired-dot"} />
                      {live
                        ? "Your story is ready for its person"
                        : "This link has expired"}
                    </span>
                    <Field label="Your private link">
                      <div className="share-input">
                        <input
                          aria-label="Your private link"
                          readOnly
                          value={shareUrl}
                          onFocus={(event) => event.target.select()}
                        />
                        <button
                          className="icon-button"
                          aria-label="Copy private link"
                          title="Copy link"
                          onClick={() => void copyLink()}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </Field>
                    <div className="share-result-actions">
                      <a
                        className="text-button"
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Link2 size={14} />
                        Open story
                      </a>
                      {typeof navigator !== "undefined" &&
                        typeof navigator.share === "function" && (
                          <button
                            className="text-button"
                            onClick={() => {
                              void navigator
                                .share({
                                  title: `A birthday story for ${draft.recipientName}`,
                                  url: shareUrl,
                                })
                                .catch((failure: unknown) => {
                                  if (
                                    !(
                                      failure instanceof DOMException &&
                                      failure.name === "AbortError"
                                    )
                                  )
                                    setError(
                                      "Sharing isn't available here. Copy your link instead.",
                                    );
                                });
                            }}
                          >
                            <Share2 size={14} />
                            Share
                          </button>
                        )}
                      <button
                        className="text-button danger-text"
                        onClick={revoke}
                      >
                        Revoke link
                      </button>
                    </div>
                    {record.expiresAt && (
                      <span className="field-hint">
                        Expires{" "}
                        {new Date(record.expiresAt).toLocaleDateString()}.
                      </span>
                    )}
                  </div>
                )}
                {record && (
                  <button
                    className="text-button danger-text delete-story"
                    onClick={removeStory}
                  >
                    <Trash2 size={14} />
                    Delete this experience
                  </button>
                )}
              </div>
            )}
          </fieldset>
          <div className="editor-step-navigation">
            <button
              className="text-button"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <span>
              0{step + 1} <span>/</span> 05
            </span>
            {step < 4 ? (
              <button
                className="button button-primary"
                onClick={() => setStep(step + 1)}
              >
                Continue
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="button button-secondary"
                onClick={() => {
                  setPreview(true);
                  window.scrollTo(0, 0);
                }}
                disabled={Boolean(busy)}
              >
                <Eye size={15} />
                Preview story
              </button>
            )}
          </div>
        </main>

        <aside className="studio-preview" aria-label="Story preview">
          <div className="preview-label">
            <Eye size={13} />
            <span>A LITTLE PEEK</span>
            <span className="preview-status">
              {live ? "Published" : "Private draft"}
            </span>
          </div>
          <div className="preview-cover">
            <Image
              src={draft.heroImage}
              alt="Your selected cover photograph"
              fill
              sizes="(max-width: 1100px) 300px, 360px"
              unoptimized={draft.heroImage.startsWith("/api/")}
            />
            <div className="preview-cover-shade" />
            <div>
              {presentation.showBirthday && (
                <span>{formatDate(draft.birthday, false).toUpperCase()}</span>
              )}
              <h3>
                {presentation.copy.wishHeading}
                <br />
                <em>{draft.recipientName || "my love"}.</em>
              </h3>
              {draft.subtitle && <p>{draft.subtitle}</p>}
              <Heart size={19} strokeWidth={1.1} />
            </div>
          </div>
          <div className="preview-caption">
            <span>WITH LOVE, FROM</span>
            <h3>{draft.senderName || "Your person"}</h3>
            <div className="preview-mini-memories">
              {draft.memories
                .filter((memory) => memory.kind === "image" && memory.url)
                .slice(0, 3)
                .map((memory) => (
                  <div key={memory.id}>
                    <Image
                      src={memory.url}
                      alt={memory.title || "Memory preview"}
                      fill
                      sizes="90px"
                      unoptimized={memory.url.startsWith("/api/")}
                    />
                  </div>
                ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setPreview(true);
                window.scrollTo(0, 0);
              }}
              disabled={Boolean(busy) || loading}
            >
              Open the full experience
              <ArrowRight size={14} />
            </button>
          </div>
          <span className="preview-bottom-note">
            <Heart size={12} />
            Little moments. Lasting memories.
          </span>
        </aside>
      </div>
      <footer className="studio-footer">
        <span>Made for your favorite person.</span>
        <Heart size={12} />
        <Link href="/" onNavigate={guardExit}>
          A little inspiration
          <ArrowRight size={12} />
        </Link>
      </footer>
      {authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onSignedIn={(user) => {
            void signedIn(user);
          }}
        />
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p>{confirmation.message}</p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                const action = confirmation.action;
                setConfirmation(null);
                action();
              }}
            >
              Continue
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
