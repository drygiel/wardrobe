'use client';

import { useRef } from 'react';
import ImageGallery, { type ReactImageGalleryItem } from 'react-image-gallery';
import cn from 'classnames';
import { Button } from 'antd';
import { LoginOutlined, PictureOutlined } from '@ant-design/icons';
import { useApp } from '@/contexts/AppContext';
import styles from './Intro.module.scss';

export default function Intro() {
  const { view, setView, setGizmo } = useApp();
  const galleryRef = useRef<ImageGallery>(null!);
  const introRef = useRef<HTMLElement>(null!);

  const images = Array.from({ length: 33 }).map(
    (_, i) =>
      ({
        original: `${process.env.NEXT_PUBLIC_BASEPATH ?? ''}/images/${i + 1}.jpg`,
        thumbnail: `${process.env.NEXT_PUBLIC_BASEPATH ?? ''}/images/${i + 1}.jpg`,
        originalHeight: 2080,
      }) as ReactImageGalleryItem,
  );

  const openGallery = () => {
    galleryRef.current?.fullScreen();
  };

  const openEditor = () => {
    introRef.current.style.display = 'none';
    setGizmo(true);
  };

  return (
    <>
      <section
        ref={introRef}
        className={cn(styles.intro, { [styles.leftSide]: view == 'left-side' })}
      >
        <main>
          <h1>
            Projekt
            <br /> Szafy 2025
          </h1>
          <p>
            Kliknij na dowolny element szafy, aby zobaczyć jego wymiary.
            <br />
            Kliknij na przycisk "Wireframe" aby przełączyć widok.
          </p>
          <p className={styles.actions}>
            <Button icon={<PictureOutlined />} type="primary" onClick={() => openGallery()}>
              Zobacz zdjęcia
            </Button>

            <Button
              icon={<LoginOutlined />}
              type="default"
              onClick={() => {
                setView(v => (v === 'initial' ? 'left-side' : 'initial'));
              }}
            >
              Zobacz etapy
            </Button>
          </p>
        </main>
        <aside>
          <h1>Drewniana Rama</h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nunc nec
            ultricies.
          </p>
          <p className={styles.actions}>
            <Button icon={<LoginOutlined />} type="primary" onClick={() => openEditor()}>
              Pomiary
            </Button>

            <Button
              icon={<LoginOutlined />}
              type="default"
              onClick={() => {
                setView(v => (v === 'initial' ? 'left-side' : 'initial'));
              }}
            >
              Wstecz
            </Button>
          </p>
        </aside>
      </section>

      <section id="gallery" className={styles.gallery} style={{ display: 'none' }}>
        <ImageGallery
          ref={galleryRef}
          items={images}
          showThumbnails={false}
          showPlayButton={false}
          infinite
          onScreenChange={fullScreen => {
            document.getElementById('gallery')!.style.display = fullScreen ? 'block' : 'none';
          }}
        />
      </section>
    </>
  );
}
