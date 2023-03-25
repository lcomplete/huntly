import {CssBaseline, Drawer, IconButton, StyledEngineProvider, Typography} from "@mui/material";
import React from "react";
import styles from './article.module.css';
import CloseIcon from '@mui/icons-material/Close';

export default function Article({page}: { page: PageModel }) {
  const [open, setOpen] = React.useState(true);
  
  function handleClose(){
    setOpen(false);
    document.getElementById("huntly_preview_unique_root").removeAttribute("data-preview");
  }
  
  return (
    <StyledEngineProvider injectFirst>
      <CssBaseline/>
      <Drawer open={open} onClose={handleClose} anchor={"right"}>
        <div className={styles.articleWrapper}>
          <div className={styles.article}>
            <article className={styles["markdown-body"]}>
              <Typography variant={"h1"} sx={{marginBottom: 2}}>
                {page.title}
              </Typography>

              <div>
                <div dangerouslySetInnerHTML={{__html: page.content}}></div>
              </div>
            </article>
          </div>
          <div className={styles.closeIcon}>
            <IconButton onClick={handleClose} size={"large"} className={styles.closeIconButton}>
              <CloseIcon />
            </IconButton>
          </div>
        </div>
      </Drawer>
    </StyledEngineProvider>
  )
}