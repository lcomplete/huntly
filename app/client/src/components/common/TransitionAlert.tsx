import * as React from 'react';
import Alert, {AlertProps} from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import CloseIcon from '@mui/icons-material/Close';

export default function TransitionAlert(props: AlertProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <Collapse in={open}>
      <Alert
        {...props}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => {
              setOpen(false);
            }}
          >
            <CloseIcon fontSize="inherit"/>
          </IconButton>
        }
      >
        {props.children}
      </Alert>
    </Collapse>
  );
}