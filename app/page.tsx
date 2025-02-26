import styles from "./page.module.scss"; 

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        Hello World
      </main>
    </div>
  );
}
