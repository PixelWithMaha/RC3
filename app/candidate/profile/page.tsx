"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Loading, PageHeader, useAction, useAsync } from "@/components/app/states";

const SUGGESTED = ["Backend", "Frontend", "Data", "DevOps", "Machine learning", "Fintech", "Healthcare", "Remote", "Startups"];

export default function ProfilePage() {
  const { data, error, loading, reload, setData } = useAsync(getMyProfile);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Could not load profile"} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Your profile" description="Your contact details stay private: they're removed before any AI scoring. Interests help us recommend jobs." />
      <ProfileForm key={data.id} profile={data} onSaved={setData} />
    </>
  );
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [name, setName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const addInterest = (v: string) => {
    const t = v.trim();
    if (t && !interests.some((i) => i.toLowerCase() === t.toLowerCase())) setInterests([...interests, t]);
    setDraft("");
    setSaved(false);
  };

  return (
    <form
      className="grid gap-4 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        action.run("save", async () => {
          onSaved(await updateMyProfile({ full_name: name, phone: phone || null, interests }));
          setSaved(true);
        });
      }}
    >
      <Card className="dash-card">
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></div>
          <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" value={profile.email ?? ""} disabled /><p className="text-xs text-muted-foreground">Your sign-in email can&apos;t be changed here.</p></div>
          <div className="grid gap-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" placeholder="+92 300 0000000" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} /></div>
          <div className="grid gap-1.5"><Label>Account type</Label><p className="text-sm capitalize text-muted-foreground">{profile.role}</p></div>
        </CardContent>
      </Card>
      <Card className="dash-card" style={{ animationDelay: "70ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Interests</CardTitle>
          <CardDescription>Areas you&apos;d like to work in. Used to boost matching job recommendations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-9 flex-wrap gap-2">
            {interests.length === 0 && <p className="text-sm text-muted-foreground">No interests yet.</p>}
            {interests.map((i) => (
              <span key={i} className="rs-pop inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-sm text-primary">
                {i}
                <button type="button" aria-label={`Remove ${i}`} onClick={() => { setInterests(interests.filter((x) => x !== i)); setSaved(false); }}><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Add an interest" value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(draft); } }} />
            <Button type="button" variant="outline" onClick={() => addInterest(draft)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.filter((s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase())).map((s) => (
              <button key={s} type="button" onClick={() => addInterest(s)} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">+ {s}</button>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-3 lg:col-span-2">
        <Button disabled={!!action.busy}>{action.busy ? "Saving…" : saved ? "Saved ✓" : "Save profile"}</Button>
        {action.error && <ErrorState message={action.error} />}
      </div>
    </form>
  );
}
