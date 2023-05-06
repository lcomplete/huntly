import React from "react";
import styles from './article.module.css';
import Modal from 'react-modal';

export default function Article({page}: { page: PageModel }) {
  const [open, setOpen] = React.useState(true);

  function handleClose(e) {
    document.getElementById("huntly_preview_unique_root").removeAttribute("data-preview");
    setOpen(false);
  }
  
  Modal.setAppElement("#huntly_preview_unique_root");

  return (
    <React.Fragment>
      {
        open &&
        <Modal isOpen={open} onRequestClose={handleClose} style={{
          overlay: {
            zIndex: 999999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.85)'
          },
          content: {
            overflow: 'auto',
            width: '840px',
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px',
            padding: '20px',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            height: '95%',
            boxSizing: 'border-box',
            transform: 'translate(-50%, -50%)',
          }
        }}>
          <div className={styles.articleWrapper}>
            <div className={styles.article}>
              <article className={styles["markdown-body"]}>
                <h1 style={{marginBottom: 2}}>
                  {page.title}
                </h1>

                <div>
                  <div dangerouslySetInnerHTML={{__html: page.content}}></div>
                </div>
              </article>
            </div>
          </div>
        </Modal>
      }
    </React.Fragment>
  )
}