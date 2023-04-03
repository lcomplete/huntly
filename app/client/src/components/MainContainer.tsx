import * as React from "react";

const MainContainer = (props) =>{
  return (
    <div className="flex-auto">
      {props.children}
    </div>
  )
}

export default MainContainer;