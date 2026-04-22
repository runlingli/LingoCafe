import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import SectionHeader from "@/components/common/SectionHeader";
import TagInput from "@/components/common/TagInput";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import { profileService } from "@/services/profileService";
import { authService } from "@/services/authService";
import type { Gender, ProfileUpdateRequest } from "@/types/profile";
import styles from "./EditProfilePage.module.css";
import { useNavigate } from "react-router-dom";

const EditProfilePage = () => {
  const { user, tokens, /* refresh, logout, */ reloadUser } = useAuth();
  const navigate = useNavigate();
  const displayName = useMemo(
    () => user?.nickname ?? user?.phone ?? user?.email ?? "LingoCafe User",
    [user]
  );

  const [nickname, setNickname] = useState<string>(user?.nickname ?? "");
  const [bio, setBio] = useState<string>(user?.bio ?? "");
  const [zgId, setZgId] = useState<string>(user?.zhId ?? "");
  const [genderText, setGenderText] = useState<string>("");
  const [genderError, setGenderError] = useState<string>("");
  const [birthday, setBirthday] = useState<string>(user?.birthday ?? "");
  const [school, setSchool] = useState<string>(user?.school ?? "");
  const [phone, setPhone] = useState<string>(user?.phone ?? "");
  const [skills, setSkills] = useState<string[]>(user?.skills ?? []);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar ?? null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setSaveMessage("");
    try {
      const result = await profileService.uploadAvatar(file);
      setAvatarUrl(result.avatar || null);
      setSaveMessage("Avatar updated");
      try {
        await reloadUser?.();
      } catch {}
    } catch (error) {
      console.error(error);
      setSaveMessage("Avatar upload failed, please try again");
    } finally {
      setUploading(false);
    }
  };

  const onAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage("");
    const payload: ProfileUpdateRequest = {};
    if (nickname.trim()) payload.nickname = nickname.trim();
    if (bio.trim()) payload.bio = bio.trim();
    if (zgId.trim()) payload.zgId = zgId.trim();
    const genderNormalized: Gender | undefined =
      genderText.toLowerCase() === "male" ? "MALE" : genderText.toLowerCase() === "female" ? "FEMALE" : undefined;
    if (genderNormalized) payload.gender = genderNormalized;
    if (birthday.trim()) payload.birthday = birthday.trim();
    if (school.trim()) payload.school = school.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (skills.length > 0) payload.tagJson = JSON.stringify(skills);

    try {
      await profileService.update(payload);
      setSaveMessage("Profile saved");
      try {
        await reloadUser?.();
      } catch {}
    } catch (error) {
      console.error(error);
      setSaveMessage("Save failed, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const avatarInitial = (displayName.trim().charAt(0) || "L").toUpperCase();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!tokens?.accessToken) return;
        const current = await authService.fetchCurrentUser(tokens.accessToken);
        if (cancelled) return;
        setNickname(current.nickname ?? "");
        setBio(current.bio ?? "");
        setZgId(current.zhId ?? "");
        setPhone(current.phone ?? "");
        setSchool(current.school ?? "");
        setBirthday(current.birthday ?? "");
        setAvatarUrl(current.avatar || null);
        if (current.gender === "MALE") setGenderText("Male");
        else if (current.gender === "FEMALE") setGenderText("Female");
        else setGenderText("");
        setGenderError("");
        if (Array.isArray(current.skills)) setSkills(current.skills);
        else if (typeof current.tagJson === "string") {
          try {
            const parsed = JSON.parse(current.tagJson);
            if (Array.isArray(parsed)) {
              setSkills(parsed.filter((x) => typeof x === "string"));
            }
          } catch (e) {
            console.warn("Failed to parse tagJson", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch current user", error);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [tokens?.accessToken]);

  useEffect(() => {
    if (!tokens?.accessToken || !user) {
      setNickname("");
      setBio("");
      setZgId("");
      setGenderText("");
      setGenderError("");
      setBirthday("");
      setSchool("");
      setPhone("");
      setSkills([]);
      setAvatarUrl(null);
    }
  }, [tokens?.accessToken, user]);

  return (
    <AppLayout
      variant="cardless"
      header={
        <MainHeader
          headline="Edit Profile"
          subtitle="Complete your info to help others get to know you"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <form className={styles.pageCard} onSubmit={onSubmit}>
        <SectionHeader
          title="Basic Info"
          subtitle="Avatar, nickname, contact info, etc."
          actions={<>
            <button type="button" className="ghost-button" onClick={() => navigate("/profile")}>Back</button>
            <button type="submit" className="ghost-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</button>
          </>}
        />

        <div className={styles.grid}>
          <div className={styles.avatarPanel}>
            <div className={styles.avatarPreview} onClick={onAvatarClick} role="button" aria-label="Click to upload avatar" tabIndex={0}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>
            <input ref={fileInputRef} id="avatar" type="file" accept="image/*" onChange={onAvatarFileChange} style={{ display: "none" }} />
            {uploading ? <span style={{ color: "var(--color-text-muted)" }}>Uploading...</span> : null}
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nickname">Nickname</label>
              <input id="nickname" className={styles.input} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Enter your nickname" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">Phone</label>
              <input id="phone" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Link your phone for easier contact" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="zgId">LingoCafe ID</label>
              <input id="zgId" className={styles.input} value={zgId} onChange={e => setZgId(e.target.value)} placeholder="Used for your personalized profile URL" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gender">Gender</label>
              <input
                id="gender"
                className={styles.input}
                value={genderText}
                onChange={e => {
                  const val = e.target.value.trim();
                  setGenderText(val);
                  if (!val || val.toLowerCase() === "male" || val.toLowerCase() === "female") {
                    setGenderError("");
                  } else {
                    setGenderError("Only 'Male' or 'Female' are accepted");
                  }
                }}
                placeholder="Enter Male or Female"
              />
              {genderError ? <span className={styles.errorMessage}>{genderError}</span> : null}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="birthday">Birthday</label>
              <input id="birthday" className={styles.input} type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="school">School / Institution</label>
              <input id="school" className={styles.input} value={school} onChange={e => setSchool(e.target.value)} placeholder="Enter your school or institution" />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="skills">Skills & Interests</label>
              <TagInput id="skills" value={skills} onChange={setSkills} placeholder="Type a tag and press Enter" />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="bio">Bio</label>
              <textarea id="bio" className={styles.textarea} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          {saveMessage ? <span style={{ color: "var(--color-primary-strong)" }}>{saveMessage}</span> : null}
        </div>
      </form>
    </AppLayout>
  );
};

export default EditProfilePage;
