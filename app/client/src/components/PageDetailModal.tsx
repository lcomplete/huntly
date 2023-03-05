import PageDetailArea from "./PageDetailArea";
import {Drawer} from "@mui/material";
import React from "react";
import {PageOperateEvent} from "./PageOperationButtons";

export default function PageDetailModal({
                                          selectedPageId,
                                          operateSuccess,
                                          onClose,
                                        }:
                                          {
                                            selectedPageId: number,
                                            operateSuccess: (event: PageOperateEvent) => void,
                                            onClose?: () => void
                                          }) {
  return <Drawer open={selectedPageId > 0} onClose={onClose} anchor={'right'}>
    <div className={'w-[1300px] p-4'}>
      {selectedPageId > 0 &&
          <PageDetailArea id={selectedPageId} onOperateSuccess={operateSuccess}/>
      }
    </div>
  </Drawer>;
}