import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import SectionHeader from "@/components/common/SectionHeader";
import TagInput from "@/components/common/TagInput";
import Select from "@/components/common/Select";
import { useRef, useState } from "react";
import { knowpostService, uploadToPresigned, computeSha256 } from "@/services/knowpostService";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import styles from "./CreatePage.module.css";

const CreatePage = () => {
  const { user, tokens } = useAuth();
  const [type, setType] = useState("图文");
  const [tags, setTags] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number>(0);
  const [visiblePublic, setVisiblePublic] = useState(true);
  const [summary, setSummary] = useState("");
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedImgUrls, setUploadedImgUrls] = useState<string[]>([]);
  const MAX_IMAGES = 15;

  const ensureDraft = async (): Promise<string> => {
    if (postId) return postId;
    const resp = await knowpostService.createDraft();
    const idStr = String(resp.id);
    setPostId(idStr);
    setMessage(`Draft created: ${idStr}`);
    return idStr;
  };

  const handleSelectImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setMessage(null);
    setImageUploading(true);
    try {
      const id = await ensureDraft();
      const currentCount = uploadedImgUrls.length;
      const remaining = Math.max(0, MAX_IMAGES - currentCount);
      if (remaining <= 0) {
        setError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }
      const allSelected = Array.from(files);
      const arr = allSelected.slice(0, remaining);
      for (const f of arr) {
        const match = f.name.match(/\.[^.]+$/);
        const ext = match ? match[0] : ".jpg";
        const contentType = f.type || (ext.toLowerCase() === ".png" ? "image/png" : ext.toLowerCase() === ".svg" ? "image/svg+xml" : "image/jpeg");
        const presign = await knowpostService.presign({
          scene: "knowpost_image",
          postId: id,
          contentType,
          ext
        });
        await uploadToPresigned(presign.putUrl, presign.headers, f);
        const publicUrl = presign.putUrl.split("?")[0];
        setUploadedImgUrls(prev => [...prev, publicUrl]);
      }
      const ignored = allSelected.length - arr.length;
      setMessage(`Uploaded ${arr.length} image(s)${ignored > 0 ? ` (limit exceeded, ${ignored} ignored)` : ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image upload failed";
      setError(msg);
    } finally {
      setImageUploading(false);
    }
  };

  const handlePublish = async () => {
    setMessage(null);
    setError(null);
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!content.trim()) {
      setError("Please enter content");
      return;
    }
    if (summary.trim().length > 50) {
      setError("Summary cannot exceed 50 characters");
      return;
    }
    setSubmitting(true);
    try {
      const id = await ensureDraft();

      const file = new File([content], "content.md", { type: "text/markdown" });
      const size = file.size;
      const sha256 = await computeSha256(file);
      const presign = await knowpostService.presign({
        scene: "knowpost_content",
        postId: id,
        contentType: "text/markdown",
        ext: ".md"
      });
      const { etag } = await uploadToPresigned(presign.putUrl, presign.headers, file);

      await knowpostService.confirmContent(id, {
        objectKey: presign.objectKey,
        etag,
        size,
        sha256
      });

      const description = summary.trim();
      await knowpostService.update(id, {
        title: title.trim(),
        tags: tags.length ? tags : undefined,
        imgUrls: uploadedImgUrls.length ? uploadedImgUrls : undefined,
        visible: visiblePublic ? "public" : "private",
        isTop: false,
        description: description || undefined
      });

      await knowpostService.publish(id);
      setMessage("Published successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Publish failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };
  const handleToggleAiSummary = async () => {
    if (!aiSummaryEnabled) {
      if (!tokens?.accessToken) {
        setError("Please sign in to use AI summary");
        return;
      }
      if (!content.trim()) {
        setError("Content is empty, cannot generate summary");
        return;
      }
      setAiSummaryLoading(true);
      setMessage(null);
      setError(null);
      try {
        const resp = await knowpostService.suggestDescription(content, tokens.accessToken);
        const desc = (resp.description ?? "").slice(0, 50);
        setSummary(desc);
        setAiSummaryEnabled(true);
        setMessage("AI summary generated");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        setError(msg);
      } finally {
        setAiSummaryLoading(false);
      }
    } else {
      setAiSummaryEnabled(false);
    }
  };

  return (
    <AppLayout
      header={
        <MainHeader
          headline="Create New Post"
          subtitle="Share your knowledge and help others learn"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <div className={styles.formCard}>
        <SectionHeader title="Basic Info" subtitle="Describe your content clearly to help learners discover it" />
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Title *
            </label>
            <input
              id="title"
              className={styles.input}
              placeholder="Enter a title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <Select
            id="type"
            label="Content Type *"
            value={type}
            onChange={setType}
            options={[
              { label: "Article", value: "图文" },
              { label: "Video", value: "视频" }
            ]}
          />
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label}>Images (multiple) *</label>
            <div
              className={styles.uploadBox}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (uploadedImgUrls.length >= MAX_IMAGES) {
                  setError(`Maximum ${MAX_IMAGES} images allowed`);
                  return;
                }
                fileInputRef.current?.click();
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            >
              <span>{imageUploading ? "Uploading…" : "Click to upload images"}</span>
              <small>Supports JPG / PNG / SVG, up to {MAX_IMAGES} images; max 5MB each (selected: {uploadedImgUrls.length} / {MAX_IMAGES})</small>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.fileInputHidden}
                onChange={e => handleSelectImages(e.target.files)}
              />
            </div>
            {uploadedImgUrls.length > 0 ? (
              <div className={styles.thumbGrid}>
                {uploadedImgUrls.map((url, idx) => (
                  <img key={idx} src={url} alt="" className={styles.thumb} onClick={() => setPreviewUrl(url)} />
                ))}
              </div>
            ) : null}
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="content">
              Content *
            </label>
            <textarea
              id="content"
              className={styles.textarea}
              placeholder="Write your content in Markdown..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.fieldHeader}>
              <label className={styles.label} htmlFor="summary">Summary</label>
              <div className={styles.headActions}>
                <span>AI Summary</span>
                <div
                  className={`${styles.inlineSwitch} ${aiSummaryEnabled ? styles.inlineSwitchOn : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={aiSummaryEnabled}
                  aria-label="AI Summary toggle"
                  onClick={handleToggleAiSummary}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleToggleAiSummary(); }}
                />
                {aiSummaryLoading ? <small className={styles.muted}>Generating…</small> : null}
              </div>
            </div>
            <textarea
              id="summary"
              className={styles.textarea}
              placeholder="Enter a summary (up to 50 characters)"
              value={summary}
              onChange={e => setSummary(e.target.value)}
            />
            <small className={summary.trim().length > 50 ? styles.charCountOver : styles.charCount}>
              {summary.trim().length} / 50
            </small>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="price">
              Price
            </label>
            <input
              id="price"
              className={styles.input}
              type="number"
              min="0"
              step="0.1"
              value={isFree ? 0 : price}
              onChange={e => setPrice(Number(e.target.value))}
              disabled={isFree}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tags">
              Tags
            </label>
            <TagInput
              id="tags"
              value={tags}
              onChange={setTags}
              placeholder="Type a tag and press Enter"
            />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div
              className={styles.toggle}
              role="button"
              tabIndex={0}
              onClick={() => setIsFree(prev => !prev)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsFree(prev => !prev); }}
            >
              <div>
                <div className={styles.label}>Free to share</div>
                <small>{isFree ? "Enabled" : "Turn off to set a price"}</small>
              </div>
              <div className={`${styles.switch} ${isFree ? styles.switchOn : ""}`} aria-hidden="true" />
            </div>
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div
              className={styles.toggle}
              role="button"
              tabIndex={0}
              onClick={() => setVisiblePublic(prev => !prev)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setVisiblePublic(prev => !prev); }}
            >
              <div>
                <div className={styles.label}>Visibility</div>
                <small>{visiblePublic ? "Public" : "Private"}</small>
              </div>
              <div className={`${styles.switch} ${visiblePublic ? styles.switchOn : ""}`} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.submit} onClick={handlePublish} disabled={submitting}>
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {message ? <div className={styles.success}>{message}</div> : null}
        {previewUrl ? (
          <div className={styles.previewOverlay} onClick={() => setPreviewUrl(null)}>
            <img src={previewUrl} className={styles.previewImage} alt="Preview" />
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default CreatePage;
