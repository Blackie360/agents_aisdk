"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Users, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useQueryState(
    "workspace",
    parseAsString,
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data, error, mutate } = useSWR<{ workspaces: Workspace[] }>(
    "/api/workspaces",
    fetcher,
  );

  const workspaces = data?.workspaces || [];
  const selectedWorkspace = workspaces.find((w) => w.id === workspaceId);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWorkspaceName,
          description: newWorkspaceDescription || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create workspace");
      }

      const { workspace } = await response.json();
      await mutate();
      setWorkspaceId(workspace.id);
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      toast.success("Workspace created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workspaceId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload CSV");
      }

      const result = await response.json();
      setIsUploadDialogOpen(false);
      toast.success(
        `Successfully imported ${result.membersAdded} members from CSV`,
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to upload CSV");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    // Auto-select first workspace if none selected
    if (!workspaceId && workspaces.length > 0) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, workspaceId, setWorkspaceId]);

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load workspaces
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            <span className="truncate">
              {selectedWorkspace?.name || "Select workspace"}
            </span>
            <ChevronDown className="ml-2 size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {workspaces.length === 0 ? (
            <DropdownMenuItem disabled>No workspaces</DropdownMenuItem>
          ) : (
            workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setWorkspaceId(workspace.id)}
              >
                {workspace.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="outline">
            <Plus className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to organize your community management
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g., Cursor Community"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={newWorkspaceDescription}
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                placeholder="Brief description of this workspace..."
                rows={3}
              />
            </div>
            <Button
              onClick={handleCreateWorkspace}
              disabled={isCreating || !newWorkspaceName.trim()}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {workspaceId && (
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline" title="Upload CSV">
              <Upload className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Members CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file with member names and emails. The CSV should
                have columns for "name" and "email".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>
              {isUploading && (
                <div className="text-sm text-muted-foreground">
                  Uploading and processing CSV...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedWorkspace && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span>{selectedWorkspace.name}</span>
        </div>
      )}
    </div>
  );
}

