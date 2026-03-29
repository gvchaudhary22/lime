"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";

interface FileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  fileId: string;
  fileName: string;
  initialContent: string;
  onSaved?: () => void;
}

export default function FileEditor({
  isOpen,
  onClose,
  projectId,
  fileId,
  fileName,
  initialContent,
  onSaved,
}: FileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset content when a different file is opened
  useEffect(() => {
    setContent(initialContent);
    setSaved(false);
  }, [fileId, initialContent]);

  const handleSave = async () => {
    setSaving(true);
    const res = await api.updateFileContent(projectId, fileId, content);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={fileName} size="xl">
      <div className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          className="w-full h-[50vh] px-4 py-3 rounded-xl bg-[#0c0515] border border-white/[0.08] text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
          spellCheck={false}
        />
        <div className="flex justify-end gap-3">
          {saved && (
            <span className="text-sm text-green-400 self-center">Saved</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
