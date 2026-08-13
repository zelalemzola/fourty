"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "next-themes";
import {
  BellRing,
  Building2,
  CheckCircle2,
  Download,
  Info,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Settings,
  Shield,
  Smartphone,
  Store,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import { clearAuth } from "@/store/slices/authSlice";
import type { OrganizationSettings, UserPreferences } from "@/types/database";
import {
  useChangePasswordMutation,
  useGetMyPreferencesQuery,
  useGetMyProfileQuery,
  useGetMyPushDevicesQuery,
  useGetOrgSettingsQuery,
  useRemovePushDeviceMutation,
  useUpdateMyPreferencesMutation,
  useUpdateMyProfileMutation,
  useUpdateOrgSettingsMutation,
} from "@/store/api/fourtyApi";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  hasLocalPushSubscription,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

function rtkError(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "data" in err &&
    typeof (err as { data?: unknown }).data === "string"
  ) {
    return (err as { data: string }).data;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const NOTIFY_TOGGLES: {
  key: keyof UserPreferences;
  label: string;
  hint: string;
}[] = [
  { key: "notify_sales", label: "Sales", hint: "New sale recordings" },
  { key: "notify_restock", label: "Restocks", hint: "Inventory replenished" },
  { key: "notify_low_stock", label: "Low stock", hint: "Below minimum alerts" },
  { key: "notify_batches", label: "Batches", hint: "Subagent stock issues" },
  { key: "notify_reports", label: "Reports", hint: "Report milestones" },
  {
    key: "notify_remittances",
    label: "Remittances",
    hint: "Money transfer updates",
  },
  { key: "notify_closeouts", label: "Closeouts", hint: "End-of-day submissions" },
  { key: "notify_users", label: "Team", hint: "Account and role changes" },
  { key: "notify_system", label: "System", hint: "Policy and platform notices" },
];

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel space-y-4 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();
  const authProfile = useSelector((s: RootState) => s.auth.profile);
  const isOwner = authProfile?.role === "owner";

  const { data: profile, isLoading: profileLoading } = useGetMyProfileQuery();
  const me = profile || authProfile;

  const { data: preferences, isLoading: prefsLoading, isError: prefsError } =
    useGetMyPreferencesQuery();
  const { data: orgSettings, isLoading: orgLoading } = useGetOrgSettingsQuery();
  const { data: devices = [], isLoading: devicesLoading, refetch: refetchDevices } =
    useGetMyPushDevicesQuery();

  const [updateProfile, { isLoading: savingProfile }] =
    useUpdateMyProfileMutation();
  const [changePassword, { isLoading: savingPassword }] =
    useChangePasswordMutation();
  const [updatePrefs, { isLoading: savingPrefs }] =
    useUpdateMyPreferencesMutation();
  const [updateOrg, { isLoading: savingOrg }] = useUpdateOrgSettingsMutation();
  const [removeDevice, { isLoading: removingDevice }] =
    useRemovePushDeviceMutation();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgForm, setOrgForm] = useState<Partial<OrganizationSettings>>({});
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [localSubscribed, setLocalSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!me) return;
    setFullName(me.full_name || "");
    setPhone(me.phone || "");
  }, [me]);

  useEffect(() => {
    if (!orgSettings) return;
    setOrgForm(orgSettings);
  }, [orgSettings]);

  async function refreshPushState() {
    if (!isPushSupported()) {
      setPushPermission("unsupported");
      setLocalSubscribed(false);
      return;
    }
    setPushPermission(Notification.permission);
    setLocalSubscribed(await hasLocalPushSubscription());
  }

  useEffect(() => {
    void refreshPushState();
  }, [devices]);

  const pushReady =
    pushPermission === "granted" && (localSubscribed || devices.length > 0);

  const companyLabel = orgSettings?.company_name || "Fourty";

  const quietSummary = useMemo(() => {
    if (!preferences?.quiet_hours_enabled) return "Off";
    return `${preferences.quiet_hours_start?.slice(0, 5) || "—"} → ${
      preferences.quiet_hours_end?.slice(0, 5) || "—"
    }`;
  }, [preferences]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile({
        full_name: fullName,
        phone: phone || null,
      }).unwrap();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(rtkError(err, "Could not update profile"));
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (err) {
      toast.error(rtkError(err, "Could not change password"));
    }
  }

  async function togglePref(key: keyof UserPreferences, value: boolean) {
    try {
      await updatePrefs({ [key]: value }).unwrap();
      toast.success("Notification preference saved");
    } catch (err) {
      toast.error(rtkError(err, "Could not save preference"));
    }
  }

  async function saveQuietHours(patch: Partial<UserPreferences>) {
    try {
      await updatePrefs(patch).unwrap();
      toast.success("Quiet hours updated");
    } catch (err) {
      toast.error(rtkError(err, "Could not update quiet hours"));
    }
  }

  async function onSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    try {
      await updateOrg({
        company_name: orgForm.company_name?.trim() || "Fourty",
        company_phone: orgForm.company_phone || null,
        company_address: orgForm.company_address || null,
        company_city: orgForm.company_city || null,
        currency_code: (orgForm.currency_code || "ETB").toUpperCase(),
        timezone: orgForm.timezone || "Africa/Addis_Ababa",
        default_min_stock: Number(orgForm.default_min_stock ?? 10),
        require_sale_screenshot: !!orgForm.require_sale_screenshot,
        require_remittance_proof: !!orgForm.require_remittance_proof,
        allow_negative_stock: !!orgForm.allow_negative_stock,
        closeout_reminder_hour: Number(orgForm.closeout_reminder_hour ?? 18),
        fiscal_year_start_month: Number(orgForm.fiscal_year_start_month ?? 1),
      }).unwrap();
      toast.success("Organization settings saved");
    } catch (err) {
      toast.error(rtkError(err, "Could not save organization settings"));
    }
  }

  async function enablePush() {
    try {
      setPushLoading(true);
      await subscribeToPush();
      await refetchDevices();
      await refreshPushState();
      toast.success("Push notifications enabled on this device");
    } catch (e) {
      await refreshPushState();
      toast.error(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setPushLoading(false);
    }
  }

  async function disablePushOnThisDevice() {
    try {
      setPushLoading(true);
      await unsubscribeFromPush();
      await refetchDevices();
      await refreshPushState();
      toast.success("Push disabled on this device");
    } catch (err) {
      toast.error(rtkError(err, "Could not disable push"));
    } finally {
      setPushLoading(false);
    }
  }

  async function onSendTestPush() {
    try {
      setTestPushLoading(true);
      await sendTestPush();
      await refetchDevices();
      await refreshPushState();
      toast.success("Test notification sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test push failed");
    } finally {
      setTestPushLoading(false);
    }
  }

  async function revokeDevice(id: string) {
    try {
      await removeDevice({ id }).unwrap();
      toast.success("Device removed");
    } catch (err) {
      toast.error(rtkError(err, "Could not remove device"));
    }
  }

  async function revokeAllDevices() {
    try {
      await unsubscribeFromPush({ all: true });
      await refetchDevices();
      toast.success("All push devices revoked");
    } catch (err) {
      toast.error(rtkError(err, "Could not revoke devices"));
    }
  }

  function exportMyData() {
    if (!me) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            profile: me,
            preferences: preferences || null,
            push_devices: devices,
            organization: isOwner ? orgSettings : undefined,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fourty-settings-${me.email}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings export downloaded");
  }

  async function signOut() {
    try {
      setSigningOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      dispatch(clearAuth());
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description={`Manage your ${companyLabel} profile, security, alerts, and company policies.`}
        icon={Settings}
        actions={
          <Button variant="outline" onClick={exportMyData} disabled={!me}>
            <Download className="size-4" />
            Export my data
          </Button>
        }
      />

      <Tabs defaultValue="profile" className="gap-4">
        <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0">
          <TabsList
            variant="line"
            className="h-auto min-h-10 w-max max-w-none flex-nowrap justify-start gap-0.5 px-1 sm:w-full sm:max-w-full sm:gap-1"
          >
            <TabsTrigger value="profile" className="min-h-9 shrink-0 px-2.5 sm:px-3">
              <User />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="min-h-9 shrink-0 px-2.5 sm:px-3">
              <Shield />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="min-h-9 shrink-0 px-2.5 sm:px-3"
            >
              <BellRing />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="min-h-9 shrink-0 px-2.5 sm:px-3"
            >
              <Palette />
              <span>Appearance</span>
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger
                value="organization"
                className="min-h-9 shrink-0 px-2.5 sm:px-3"
              >
                <Building2 />
                <span>Organization</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="about" className="min-h-9 shrink-0 px-2.5 sm:px-3">
              <Info />
              <span>About</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4">
          <SectionCard
            icon={User}
            title="Profile"
            description="Update how your name appears across sales, audit, and team views."
          >
            {profileLoading && !me ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={onSaveProfile} className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="settings-name">Full name</Label>
                  <Input
                    id="settings-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={me?.email || ""} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-phone">Phone</Label>
                  <Input
                    id="settings-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251…"
                  />
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Role
                  </p>
                  <Badge variant="secondary" className="mt-1 capitalize">
                    <Shield className="size-3" />
                    {me?.role}
                  </Badge>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Store
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-medium">
                    <Store className="size-3.5 text-muted-foreground" />
                    {me?.stores?.name || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SectionCard
            icon={KeyRound}
            title="Change password"
            description="Verify your current password, then set a new one (min 8 characters)."
          >
            <form onSubmit={onChangePassword} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            icon={LogOut}
            title="Session"
            description="Sign out of Fourty on this browser."
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Member since {me ? formatDateTime(me.created_at) : "—"}
              </p>
              <Button
                variant="destructive"
                onClick={signOut}
                disabled={signingOut}
              >
                <LogOut className="size-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <SectionCard
            icon={BellRing}
            title="Push on this device"
            description="Receive browser alerts for operations you care about."
            action={
              pushReady ? (
                <Badge variant="secondary">
                  <CheckCircle2 className="size-3.5" />
                  Ready
                </Badge>
              ) : null
            }
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Status:{" "}
                {pushPermission === "unsupported"
                  ? "Not supported"
                  : pushPermission === "denied"
                    ? "Blocked in browser"
                    : pushReady
                      ? "Registered on this device"
                      : pushPermission === "granted"
                        ? "Browser allowed — register this device"
                        : "Not enabled yet"}
              </p>
              <div className="flex flex-wrap gap-2">
                {pushReady ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={onSendTestPush}
                      disabled={testPushLoading || pushLoading}
                    >
                      {testPushLoading ? "Sending…" : "Send test"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={disablePushOnThisDevice}
                      disabled={pushLoading}
                    >
                      Disable this device
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={enablePush}
                    disabled={
                      pushLoading ||
                      pushPermission === "unsupported" ||
                      pushPermission === "denied"
                    }
                  >
                    <BellRing className="size-4" />
                    {pushLoading
                      ? "Enabling…"
                      : pushPermission === "granted"
                        ? "Register this device"
                        : "Enable alerts"}
                  </Button>
                )}
              </div>
            </div>
            {pushPermission === "denied" && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Notifications are blocked. Allow them in your browser site
                settings, then reload.
              </p>
            )}
            {pushPermission === "granted" && !pushReady && (
              <p className="text-xs text-muted-foreground">
                Permission is on, but this account has no saved push
                subscription yet. Tap Register this device, then Send test.
              </p>
            )}
          </SectionCard>

          <SectionCard
            icon={Smartphone}
            title="Registered devices"
            description="Revoke push subscriptions from phones or browsers you no longer use."
            action={
              devices.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={revokeAllDevices}
                  disabled={removingDevice}
                >
                  Revoke all
                </Button>
              ) : null
            }
          >
            {devicesLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No push devices registered yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {d.user_agent || "Unknown browser"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDateTime(d.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => revokeDevice(d.id)}
                      disabled={removingDevice}
                      aria-label="Remove device"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={BellRing}
            title="Alert preferences"
            description="Choose which in-app and push categories you receive."
          >
            {prefsError ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Notification preferences require the settings SQL migration.
                Run <code className="text-xs">supabase/settings.sql</code> in
                your Supabase SQL editor, then refresh.
              </p>
            ) : prefsLoading || !preferences ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {NOTIFY_TOGGLES.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                    <Switch
                      checked={Boolean(preferences[item.key])}
                      disabled={savingPrefs}
                      onCheckedChange={(checked) =>
                        togglePref(item.key, checked)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={Moon}
            title="Quiet hours"
            description="Suppress push alerts during a daily window (in-app notifications still save)."
          >
            {!preferences || prefsError ? (
              <p className="text-sm text-muted-foreground">
                Available after preferences are configured. Current:{" "}
                {quietSummary}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 sm:col-span-3">
                  <Label htmlFor="quiet-enabled">Enable quiet hours</Label>
                  <Switch
                    id="quiet-enabled"
                    checked={preferences.quiet_hours_enabled}
                    disabled={savingPrefs}
                    onCheckedChange={(checked) =>
                      saveQuietHours({ quiet_hours_enabled: checked })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={preferences.quiet_hours_start?.slice(0, 5) || "22:00"}
                    disabled={
                      savingPrefs || !preferences.quiet_hours_enabled
                    }
                    onChange={(e) =>
                      saveQuietHours({
                        quiet_hours_start: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={preferences.quiet_hours_end?.slice(0, 5) || "06:00"}
                    disabled={
                      savingPrefs || !preferences.quiet_hours_enabled
                    }
                    onChange={(e) =>
                      saveQuietHours({
                        quiet_hours_end: e.target.value || null,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <SectionCard
            icon={Palette}
            title="Theme"
            description="Choose light, dark, or follow the system."
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition",
                    theme === opt.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <opt.icon className="size-4" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {isOwner && (
          <TabsContent value="organization" className="space-y-4">
            <SectionCard
              icon={Building2}
              title="Company profile"
              description="Brand and location details for the distribution business."
            >
              {orgLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <form onSubmit={onSaveOrg} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Company name</Label>
                    <Input
                      value={orgForm.company_name || ""}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          company_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input
                      value={orgForm.company_phone || ""}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          company_phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input
                      value={orgForm.company_city || ""}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          company_city: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={orgForm.company_address || ""}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          company_address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <Select
                      value={orgForm.currency_code || "ETB"}
                      onValueChange={(v) =>
                        setOrgForm((f) => ({
                          ...f,
                          currency_code: v || "ETB",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETB">ETB — Ethiopian Birr</SelectItem>
                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Select
                      value={orgForm.timezone || "Africa/Addis_Ababa"}
                      onValueChange={(v) =>
                        setOrgForm((f) => ({
                          ...f,
                          timezone: v || "Africa/Addis_Ababa",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Africa/Addis_Ababa">
                          Africa/Addis_Ababa
                        </SelectItem>
                        <SelectItem value="Africa/Nairobi">
                          Africa/Nairobi
                        </SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Default min stock</Label>
                    <Input
                      type="number"
                      min={0}
                      value={orgForm.default_min_stock ?? 10}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          default_min_stock: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Closeout reminder hour</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={orgForm.closeout_reminder_hour ?? 18}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          closeout_reminder_hour: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fiscal year start month</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={orgForm.fiscal_year_start_month ?? 1}
                      onChange={(e) =>
                        setOrgForm((f) => ({
                          ...f,
                          fiscal_year_start_month: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          Require sale screenshots
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enforce payment proof on every sale
                        </p>
                      </div>
                      <Switch
                        checked={!!orgForm.require_sale_screenshot}
                        onCheckedChange={(checked) =>
                          setOrgForm((f) => ({
                            ...f,
                            require_sale_screenshot: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          Require remittance proof
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bank transfer / deposit evidence required
                        </p>
                      </div>
                      <Switch
                        checked={!!orgForm.require_remittance_proof}
                        onCheckedChange={(checked) =>
                          setOrgForm((f) => ({
                            ...f,
                            require_remittance_proof: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          Allow negative store stock
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Permit sales that overdraw inventory (audit risk)
                        </p>
                      </div>
                      <Switch
                        checked={!!orgForm.allow_negative_stock}
                        onCheckedChange={(checked) =>
                          setOrgForm((f) => ({
                            ...f,
                            allow_negative_stock: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={savingOrg}>
                      {savingOrg ? "Saving…" : "Save organization settings"}
                    </Button>
                  </div>
                </form>
              )}
            </SectionCard>
          </TabsContent>
        )}

        <TabsContent value="about" className="space-y-4">
          <SectionCard icon={Info} title={`About ${companyLabel}`}>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{companyLabel}</span>{" "}
                is an operations console for cigarette wholesale and
                distribution — tracking store inventory, subagent batches, sales
                with proof screenshots, restocks, remittances, and team access.
              </p>
              <p>
                Owners see the full company picture. Storekeepers manage their
                assigned location. Subagents work from issued batches and record
                field sales with photo evidence.
              </p>
              <dl className="grid gap-2 rounded-xl border border-border/60 bg-background/50 p-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Currency
                  </dt>
                  <dd className="font-medium text-foreground">
                    {orgSettings?.currency_code || "ETB"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Timezone
                  </dt>
                  <dd className="font-medium text-foreground">
                    {orgSettings?.timezone || "Africa/Addis_Ababa"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Your role
                  </dt>
                  <dd className="font-medium capitalize text-foreground">
                    {me?.role || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Account
                  </dt>
                  <dd className="font-medium text-foreground">
                    {me?.email || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
