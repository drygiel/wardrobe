import { Link } from 'react-router';
import { picture } from '@/assets';
import { useReveal } from '@/hooks/useReveal';
import styles from './FrameTeaser.module.scss';

// Three pictures down a diagonal: the frame, its LED channels, the three boards it is cut from
export default function FrameTeaser() {
  const first = useReveal<HTMLParagraphElement>();
  const second = useReveal<HTMLParagraphElement>();
  const third = useReveal<HTMLParagraphElement>();

  return (
    <section className={styles.teaser} aria-labelledby="rama-h">
      <h2 id="rama-h">Rama z litego dębu</h2>
      <figure className={styles.s1}>
        <img src={picture('assembled')} width="937" height="1232" alt="Rama szafy złożona, bez wnętrza i frontów" loading="lazy" />
      </figure>
      <p ref={first} className={styles.t1}>
        <span>
          <b>Najpierw rama.</b> 14 formatek z dębu o grubości 40 mm, od podłogi do sufitu: 2660 mm.
        </span>
      </p>
      <figure className={styles.s2}>
        <img src={picture('led')} width="900" height="900" alt="Paski LED w regale" loading="lazy" />
      </figure>
      <p ref={second} className={styles.t2}>
        <span>
          <b>Potem światło.</b> Frezy 18 × 7,5 mm pod profil LED. Końce frezów chowają się pod półkami.
        </span>
      </p>
      <figure className={styles.s3}>
        <img src={picture('boards')} width="1251" height="847" alt="Formatki rozłożone na trzech płytach" loading="lazy" />
      </figure>
      <p ref={third} className={styles.t3}>
        <span>
          <b>Wszystko z trzech płyt.</b> Rozkrój na płyty 3000 × 620 mm z jak najmniejszym odpadem. Siedem formatek ma
          ścięcia 45°.
        </span>
        <Link className="link" to="/rama">
          Zobacz ramę
        </Link>
      </p>
    </section>
  );
}
