import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import { BookOpenIcon } from "@/components/icons/Icon";
const learningEmptyState = {
  title: "No purchased content yet",
  description: "Explore quality content on the home page",
  actionLabel: "Go to Home"
};
import AuthStatus from "@/features/auth/AuthStatus";
import styles from "./LearningPage.module.css";

const LearningPage = () => {
  return (
    <AppLayout
      header={
        <MainHeader
          headline="My Learning"
          subtitle="Track your learning progress and keep growing"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <div className={styles.emptyCard}>
        <div className={styles.icon}><BookOpenIcon width={48} height={48} strokeWidth={1.2} /></div>
        <div className={styles.title}>{learningEmptyState.title}</div>
        <div className={styles.description}>{learningEmptyState.description}</div>
        <button type="button" className="ghost-button">
          {learningEmptyState.actionLabel}
        </button>
      </div>
    </AppLayout>
  );
};

export default LearningPage;
