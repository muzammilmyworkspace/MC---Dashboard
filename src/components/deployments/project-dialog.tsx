"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import {
  useDeployments, emptyProjectInput, frameworkLabel, stateMeta,
  type DeploymentState, type Environment, type Framework, type Project, type ProjectInput,
} from "@/lib/deployments";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field, TextInput, TextArea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Errors = Partial<Record<keyof ProjectInput, string>>;

const isUrl = (v: string) => /^https?:\/\/.+\..+/.test(v.trim());

export function ProjectDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Project | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Remounting on `editing` gives the form fresh state without an effect. */}
      <ProjectForm key={editing?.id ?? "new"} editing={editing} onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

const toInput = (p: Project | null): ProjectInput =>
  p
    ? {
        name: p.name, description: p.description, repoUrl: p.repoUrl,
        vercelProject: p.vercelProject, productionUrl: p.productionUrl,
        previewUrl: p.previewUrl, customDomain: p.customDomain,
        framework: p.framework, environment: p.environment,
        defaultBranch: p.defaultBranch, state: p.state, notes: p.notes,
      }
    : emptyProjectInput;

function ProjectForm({ editing, onDone }: { editing: Project | null; onDone: () => void }) {
  const { addProject, updateProject } = useDeployments();
  const [form, setForm] = useState<ProjectInput>(() => toInput(editing));
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function validate(): boolean {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "Give the project a name.";
    if (!form.repoUrl.trim()) e.repoUrl = "The GitHub repository URL is required.";
    else if (!/github\.com/i.test(form.repoUrl)) e.repoUrl = "That doesn't look like a GitHub URL.";
    if (form.productionUrl && !isUrl(form.productionUrl)) e.productionUrl = "Enter a full URL, e.g. https://example.com";
    if (form.previewUrl && !isUrl(form.previewUrl)) e.previewUrl = "Enter a full URL, e.g. https://preview.example.com";
    if (!form.defaultBranch.trim()) e.defaultBranch = "Which branch deploys to production?";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return toast.error("Please fix the highlighted fields");
    if (editing) {
      updateProject(editing.id, form);
      toast.success("Project updated");
    } else {
      addProject(form);
      toast.success("Project added", { description: `${form.name} now appears in the Deployment Center.` });
    }
    onDone();
  }

  return (
    <DialogContent side="right" className="flex flex-col p-0">
        <div className="border-b border-border p-5 pr-14">
          <DialogTitle>{editing ? "Edit project" : "Add project"}</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a landing page or website. You can add it manually now and let GitHub &amp; Vercel fill in the rest later.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Project name" required error={errors.name} htmlFor="p-name">
            <TextInput id="p-name" value={form.name} invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="Workshop landing page" />
          </Field>

          <Field label="Description" htmlFor="p-desc">
            <TextArea id="p-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this site for?" />
          </Field>

          <Field label="GitHub repository URL" required error={errors.repoUrl} hint="e.g. https://github.com/your-org/landing-page" htmlFor="p-repo">
            <TextInput id="p-repo" value={form.repoUrl} invalid={!!errors.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/…" spellCheck={false} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vercel project" hint="The project slug, e.g. team/landing-page." htmlFor="p-vercel">
              <TextInput id="p-vercel" value={form.vercelProject} onChange={(e) => set("vercelProject", e.target.value)} placeholder="team/landing-page" spellCheck={false} />
            </Field>
            <Field label="Production branch" required error={errors.defaultBranch} htmlFor="p-branch">
              <TextInput id="p-branch" value={form.defaultBranch} invalid={!!errors.defaultBranch} onChange={(e) => set("defaultBranch", e.target.value)} placeholder="main" spellCheck={false} />
            </Field>
          </div>

          <Field label="Production URL" error={errors.productionUrl} htmlFor="p-prod">
            <TextInput id="p-prod" value={form.productionUrl} invalid={!!errors.productionUrl} onChange={(e) => set("productionUrl", e.target.value)} placeholder="https://maincharacter.nl" spellCheck={false} />
          </Field>

          <Field label="Preview URL" error={errors.previewUrl} htmlFor="p-prev">
            <TextInput id="p-prev" value={form.previewUrl} invalid={!!errors.previewUrl} onChange={(e) => set("previewUrl", e.target.value)} placeholder="https://landing-git-dev.vercel.app" spellCheck={false} />
          </Field>

          <Field label="Custom domain" hint="Optional — the branded domain pointing at this project." htmlFor="p-domain">
            <TextInput id="p-domain" value={form.customDomain} onChange={(e) => set("customDomain", e.target.value)} placeholder="workshop.maincharacter.nl" spellCheck={false} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Framework" htmlFor="p-fw">
              <Select id="p-fw" value={form.framework} onChange={(e) => set("framework", e.target.value as Framework)}>
                {(Object.keys(frameworkLabel) as Framework[]).map((f) => <option key={f} value={f}>{frameworkLabel[f]}</option>)}
              </Select>
            </Field>
            <Field label="Environment" htmlFor="p-env">
              <Select id="p-env" value={form.environment} onChange={(e) => set("environment", e.target.value as Environment)}>
                <option value="production">Production</option>
                <option value="preview">Preview</option>
                <option value="development">Development</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="p-state">
              <Select id="p-state" value={form.state} onChange={(e) => set("state", e.target.value as DeploymentState)}>
                {(Object.keys(stateMeta) as DeploymentState[]).map((s) => <option key={s} value={s}>{stateMeta[s].label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="p-notes">
            <TextArea id="p-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the team should know about this site…" />
          </Field>
        </div>

      <div className="flex gap-2 border-t border-border p-4">
        <Button variant="secondary" className="flex-1" onClick={onDone}><X className="size-4" /> Cancel</Button>
        <Button className="flex-1" onClick={save}><Check className="size-4" /> {editing ? "Save changes" : "Add project"}</Button>
      </div>
    </DialogContent>
  );
}
