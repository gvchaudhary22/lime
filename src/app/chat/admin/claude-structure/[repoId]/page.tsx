"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import { api } from "@/lib/api";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

export default function StructureViewerPage() {
  const router = useRouter();
  const params = useParams();
  const repoId = params.repoId as string;

  const [repoName, setRepoName] = useState("");
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) { router.push("/"); return; }
    loadStructure();
  }, [repoId]);

  const loadStructure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAgentStructure(repoId);
      if (res.success && res.data) {
        setTree((res.data.tree || []) as FileNode[]);
        setRepoName(res.data.repo_name || repoId);
        // Auto-expand first two levels
        const paths = new Set<string>();
        ((res.data.tree || []) as FileNode[]).forEach((node: FileNode) => {
          paths.add(node.path);
          if (node.children) {
            node.children.forEach((child: FileNode) => {
              if (child.type === "directory") paths.add(child.path);
            });
          }
        });
        setExpandedPaths(paths);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const viewFile = async (path: string) => {
    setSelectedFile(path);
    setFileLoading(true);
    setFileContent("");
    try {
      const res = await api.getAgentFile(repoId, path);
      if (res.success && res.data) {
        setFileContent(res.data.content || "");
      }
    } catch {
      setFileContent("Failed to load file content");
    } finally {
      setFileLoading(false);
    }
  };

  const copyContent = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith(".md")) return "text-blue-400";
    if (name.endsWith(".yaml") || name.endsWith(".yml")) return "text-yellow-400";
    if (name.endsWith(".json")) return "text-green-400";
    if (name.endsWith(".sh")) return "text-orange-400";
    if (name.endsWith(".go")) return "text-cyan-400";
    return "text-zinc-400";
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedFile === node.path;
    const indent = depth * 16;

    if (node.type === "directory") {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleExpand(node.path)}
            className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-zinc-800/50 rounded text-sm transition"
            style={{ paddingLeft: `${indent + 8}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-400/70 shrink-0" />
            )}
            <span className="text-zinc-300 truncate">{node.name}</span>
            {node.children && (
              <span className="text-zinc-600 text-xs ml-auto">{node.children.length}</span>
            )}
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => viewFile(node.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition ${
          isSelected
            ? "bg-purple-600/20 text-purple-300"
            : "hover:bg-zinc-800/50 text-zinc-400"
        }`}
        style={{ paddingLeft: `${indent + 28}px` }}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 ${getFileIcon(node.name)}`} />
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  const isMarkdown = selectedFile?.endsWith(".md");

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel — Tree */}
        <div className="w-80 border-r border-zinc-800 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="text-lg font-bold text-white">Agent Structure</h1>
            <p className="text-xs text-zinc-500 mt-1">{repoName}</p>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            ) : tree.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">
                No agent directory found
              </div>
            ) : (
              tree.map((node) => renderNode(node))
            )}
          </div>

          {/* Stats */}
          {tree.length > 0 && (
            <div className="p-3 border-t border-zinc-800 text-xs text-zinc-600">
              {countFiles(tree)} files, {countDirs(tree)} directories
            </div>
          )}
        </div>

        {/* Right Panel — File Viewer */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* File Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${getFileIcon(selectedFile)}`} />
                  <span className="text-sm text-white font-mono">{selectedFile}</span>
                </div>
                <button
                  onClick={copyContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* File Content */}
              <div className="flex-1 overflow-auto p-5">
                {fileLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  </div>
                ) : isMarkdown ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={fileContent} />
                  </div>
                ) : (
                  <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {fileContent}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a file to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function countFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

function countDirs(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "directory") count++;
    if (node.children) count += countDirs(node.children);
  }
  return count;
}
