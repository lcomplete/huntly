import * as React from "react";

const MainContainer = (props) =>{
  return (
    <div className="flex-auto h-full overflow-y-auto">
      {props.children}
    </div>
  )
}

export default MainContainer;