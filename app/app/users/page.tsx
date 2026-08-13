"use client";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  UserCog,
  Users,
  UserX,
  Shield,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import type { RootState } from "@/store";
import type { Profile, UserRole } from "@/types/database";
import {
  useGetUsersQuery,
  useGetStoresQuery,
  useUpdateUserMutation,
  useCreateUserMutation,
} from "@/store/api/fourtyApi";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableToolbar } from "@/components/table/data-table-toolbar";
import { MobileRowCard } from "@/components/table/mobile-row-card";
import {
  RowDetailsDialog,
  rowClickProps,
} from "@/components/table/row-details-dialog";
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table/table-pagination";
import { RowActions } from "@/components/table/row-actions";

const ROLES: UserRole[] = ["owner", "storekeeper", "subagent"];

function generatePassword(length = 12) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

type CreateForm = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  storeId: string;
  isActive: boolean;
};

const emptyCreateForm = (): CreateForm => ({
  full_name: "",
  email: "",
  phone: "",
  password: generatePassword(),
  confirmPassword: "",
  role: "storekeeper",
  storeId: "none",
  isActive: true,
});

export default function UsersPage() {
  const profile = useSelector((s: RootState) => s.auth.profile);
  const isOwner = profile?.role === "owner";

  const { data: users = [], isLoading } = useGetUsersQuery(undefined, {
    skip: !isOwner,
  });
  const { data: stores = [] } = useGetStoresQuery(undefined, { skip: !isOwner });
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [detailsUser, setDetailsUser] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>("subagent");
  const [storeId, setStoreId] = useState<string>("none");
  const [isActive, setIsActive] = useState(true);

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.stores?.name || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && u.is_active) ||
        (activeFilter === "inactive" && !u.is_active);
      return matchesSearch && matchesRole && matchesActive;
    });
  }, [users, search, roleFilter, activeFilter]);

  const kpis = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const byRole = {
      owner: users.filter((u) => u.role === "owner").length,
      storekeeper: users.filter((u) => u.role === "storekeeper").length,
      subagent: users.filter((u) => u.role === "subagent").length,
    };
    return { total: users.length, active, inactive: users.length - active, byRole };
  }, [users]);

  const pager = usePagination(filtered, 10);

  function openEdit(user: Profile) {
    setEditing(user);
    setRole(user.role);
    setStoreId(user.store_id || "none");
    setIsActive(user.is_active);
    setEditOpen(true);
  }

  function openCreate() {
    const password = generatePassword();
    setCreateForm({
      ...emptyCreateForm(),
      password,
      confirmPassword: password,
    });
    setShowPassword(false);
    setCreateOpen(true);
  }

  async function toggleActive(user: Profile) {
    if (user.id === profile?.id) {
      toast.error("You cannot deactivate your own account");
      return;
    }
    try {
      await updateUser({
        id: user.id,
        is_active: !user.is_active,
      }).unwrap();
      toast.success(
        user.is_active ? "User deactivated" : "User activated"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  function userActions(user: Profile) {
    return [
      {
        label: "Edit",
        icon: <Pencil className="size-4" />,
        onClick: () => openEdit(user),
      },
      {
        label: user.is_active ? "Deactivate" : "Activate",
        icon: user.is_active ? (
          <Ban className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        ),
        variant: user.is_active ? ("destructive" as const) : undefined,
        separatorBefore: true,
        disabled: user.id === profile?.id,
        onClick: () => toggleActive(user),
      },
    ];
  }

  async function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      (role === "storekeeper" || role === "subagent") &&
      storeId === "none"
    ) {
      toast.error("Storekeepers and subagents must be linked to a store");
      return;
    }
    try {
      await updateUser({
        id: editing.id,
        role,
        store_id: storeId === "none" ? null : storeId,
        is_active: isActive,
      }).unwrap();
      toast.success("Team member updated");
      setEditOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const {
      full_name,
      email,
      phone,
      password,
      confirmPassword,
      role: createRole,
      storeId: createStoreId,
      isActive: createActive,
    } = createForm;

    if (!full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (
      (createRole === "storekeeper" || createRole === "subagent") &&
      createStoreId === "none"
    ) {
      toast.error("Storekeepers and subagents must be linked to a store");
      return;
    }

    try {
      const result = await createUser({
        full_name: full_name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password,
        role: createRole,
        store_id: createStoreId === "none" ? null : createStoreId,
        is_active: createActive,
      }).unwrap();

      setCreateOpen(false);
      setCreatedCreds({
        email: result.credentials.email,
        password: result.credentials.password,
        name: result.user.full_name,
      });
      toast.success(`${result.user.full_name} account created`);
    } catch (err) {
      const message =
        typeof err === "object" &&
        err &&
        "data" in err &&
        typeof (err as { data?: unknown }).data === "string"
          ? (err as { data: string }).data
          : err instanceof Error
            ? err.message
            : "Failed to create account";
      toast.error(message);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handleExport() {
    try {
      await exportToExcel(
        filtered.map((u) => ({
          name: u.full_name,
          email: u.email,
          role: u.role,
          store: u.stores?.name || "",
          active: u.is_active ? "yes" : "no",
          phone: u.phone || "",
        })),
        `fourty-team-${new Date().toISOString().slice(0, 10)}`,
        "Team"
      );
      toast.success("Team exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (profile && !isOwner) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Team management is available to owners only.
        </p>
      </div>
    );
  }

  const needsStore =
    createForm.role === "storekeeper" || createForm.role === "subagent";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Create login accounts for owners, storekeepers, and subagents — then assign stores."
        icon={UserCog}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!filtered.length}
            >
              <Download className="size-4" />
              Export
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Create account
            </Button>
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          title="Team size"
          value={formatNumber(kpis.total)}
          icon={Users}
        />
        <KpiCard
          title="Active"
          value={formatNumber(kpis.active)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          title="Inactive"
          value={formatNumber(kpis.inactive)}
          icon={UserX}
          tone="warn"
        />
        <KpiCard
          title="Subagents"
          value={formatNumber(kpis.byRole.subagent)}
          icon={UserCog}
          tone="accent"
          hint={`${kpis.byRole.storekeeper} storekeepers · ${kpis.byRole.owner} owners`}
        />
      </KpiGrid>

      <div className="panel space-y-3 rounded-lg p-3 sm:p-4">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, role…"
          filters={[
            {
              id: "role",
              label: "Role",
              icon: Shield,
              value: roleFilter,
              onChange: setRoleFilter,
              allLabel: "All roles",
              options: [
                { value: "owner", label: "Owner" },
                { value: "storekeeper", label: "Storekeeper" },
                { value: "subagent", label: "Subagent" },
              ],
            },
            {
              id: "active",
              label: "Status",
              icon: CircleDot,
              value: activeFilter,
              onChange: setActiveFilter,
              allLabel: "All statuses",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No team members yet. Create an account to get started.
          </p>
        ) : (
          <>
            <ul className="space-y-2 md:hidden">
              {pager.pageItems.map((u) => (
                <MobileRowCard
                  key={u.id}
                  onClick={() => setDetailsUser(u)}
                  fields={[
                    { label: "Name", value: u.full_name },
                    { label: "Email", value: u.email },
                    {
                      label: "Role",
                      value: <Badge variant="outline">{u.role}</Badge>,
                    },
                    {
                      label: "Status",
                      value: (
                        <Badge variant={u.is_active ? "secondary" : "outline"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      ),
                    },
                  ]}
                  actions={<RowActions actions={userActions(u)} />}
                />
              ))}
            </ul>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((u) => (
                    <TableRow
                      key={u.id}
                      {...rowClickProps(() => setDetailsUser(u))}
                    >
                      <TableCell className="font-medium">
                        {u.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>{u.stores?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "secondary" : "outline"}>
                          {u.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActions actions={userActions(u)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              from={pager.from}
              to={pager.to}
              onPageChange={pager.setPage}
            />
          </>
        )}
      </div>

      <RowDetailsDialog
        open={!!detailsUser}
        onOpenChange={(open) => !open && setDetailsUser(null)}
        title="Team member"
        description={detailsUser?.email}
        fields={
          detailsUser
            ? [
                { label: "Name", value: detailsUser.full_name },
                { label: "Email", value: detailsUser.email },
                { label: "Phone", value: detailsUser.phone || "—" },
                { label: "Role", value: detailsUser.role },
                { label: "Store", value: detailsUser.stores?.name || "—" },
                {
                  label: "Status",
                  value: detailsUser.is_active ? "Active" : "Inactive",
                },
              ]
            : []
        }
      />

      {/* Create account */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={onCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Create team account</DialogTitle>
              <DialogDescription>
                Creates a login email and password, then assigns role and store.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-name">Full name</Label>
                <Input
                  id="create-name"
                  required
                  value={createForm.full_name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  placeholder="Abebe Kebede"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-email">Email (login)</Label>
                <Input
                  id="create-email"
                  type="email"
                  required
                  autoComplete="off"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="keeper@fourty.com"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-phone">Phone (optional)</Label>
                <Input
                  id="create-phone"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+251…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({
                      ...f,
                      role: ((v as UserRole) || "storekeeper") as UserRole,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Store {needsStore ? "*" : "(optional)"}</Label>
                <Select
                  value={createForm.storeId}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, storeId: v ?? "none" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No store</SelectItem>
                    {stores
                      .filter((s) => s.is_active)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="create-password">Password</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      const password = generatePassword();
                      setCreateForm((f) => ({
                        ...f,
                        password,
                        confirmPassword: password,
                      }));
                      setShowPassword(true);
                    }}
                  >
                    <RefreshCw className="size-3" />
                    Generate
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="pr-9"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="create-confirm">Confirm password</Label>
                <Input
                  id="create-confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={createForm.confirmPassword}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 sm:col-span-2">
                <Label htmlFor="create-active">Active immediately</Label>
                <Switch
                  id="create-active"
                  checked={createForm.isActive}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal (one-time) */}
      <Dialog
        open={!!createdCreds}
        onOpenChange={(open) => !open && setCreatedCreds(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-accent" />
              Account ready
            </DialogTitle>
            <DialogDescription>
              Share these credentials with {createdCreds?.name}. The password
              won’t be shown again.
            </DialogDescription>
          </DialogHeader>
          {createdCreds && (
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <div className="flex gap-2">
                  <Input readOnly value={createdCreds.email} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyText("Email", createdCreds.email)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input readOnly value={createdCreds.password} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyText("Password", createdCreds.password)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() =>
                  copyText(
                    "Credentials",
                    `Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`
                  )
                }
              >
                <Copy className="size-4" />
                Copy both
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setCreatedCreds(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit team member</DialogTitle>
              <DialogDescription>
                {editing?.full_name} · {editing?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setRole(((v as UserRole) || "subagent") as UserRole)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select
                  value={storeId}
                  onValueChange={(v) => setStoreId(v ?? "none")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No store</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Storekeepers and subagents must be linked to a store.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                <Label htmlFor="user-active">Active</Label>
                <Switch
                  id="user-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={editing?.id === profile?.id}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
