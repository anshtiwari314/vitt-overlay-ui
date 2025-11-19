"use client"
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const buttonStyle = {
    //backgroundColor: color,
    color: "#fff",
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    margin: "5px",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };
  const handleMouseOver = (e:any) => {
    e.target.style.transform = "scale(1.05)";
    e.target.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.2)";
  };

  const handleMouseOut = (e) => {
    e.target.style.transform = "scale(1)";
    e.target.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  };

export function RedFilledButton(){
    return(
        <button
        style={{...buttonStyle,backgroundColor:'red'}}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        Red Button
        </button>)

}
export function GreenFillButton(){
    return(
        <button
        style={{...buttonStyle,backgroundColor:'green'}}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        Green Button
      </button>
    )
}
export function BlueFillButton(){
    return (
        
        <button
        style={{...buttonStyle,backgroundColor:'blue'}}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        Blue Button
      </button>
    )
    
}
export function GrayFillButton(){
    return (
        
        <button
        style={{...buttonStyle,backgroundColor:'grey'}}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
      >
        Blue Button
      </button>
    )
    
}

export function CustomFillButton({color,text,style,...rest}){
  
    return (
        
        <button
        style={{...buttonStyle,...style}}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        {...rest}
      >
        {text}
      </button>
    )
    
}

export function CustomFillButtonWithIcon({color,icon,style,iconComp,iconStyle,...rest}){
  
  return (
      
      <button
      style={{...buttonStyle,...style}}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      {...rest}
    >
      
      {/* <FontAwesomeIcon 
       icon={icon}
        style={{...iconStyle}}
      /> */}
      {iconComp}
    </button>
  )
  
}

export function HoverFillButtons () {
  const buttonStyle = {
    backgroundColor: "transparent",
    color: "#000",
    padding: "10px 20px",
    border: "2px solid #000",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    margin: "5px",
    transition: "background-color 0.3s ease, color 0.3s ease, transform 0.2s ease",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  };

  const hoverColors = {
    blue: "#007BFF",
    green: "#28A745",
    red: "#DC3545",
  };

  const handleMouseOver = (e, color) => {
    e.target.style.backgroundColor = color;
    e.target.style.color = "#fff";
    e.target.style.transform = "scale(1.05)";
    e.target.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.2)";
  };

  const handleMouseOut = (e:{e:any}) => {
    e.target.style.backgroundColor = "transparent";
    e.target.style.color = "#000";
    e.target.style.transform = "scale(1)";
    e.target.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <button
        style={buttonStyle}
        onMouseOver={(e) => handleMouseOver(e, hoverColors.blue)}
        onMouseOut={handleMouseOut}
      >
        Blue Button
      </button>
      <button
        style={buttonStyle}
        onMouseOver={(e) => handleMouseOver(e, hoverColors.green)}
        onMouseOut={handleMouseOut}
      >
        Green Button
      </button>
      <button
        style={buttonStyle}
        onMouseOver={(e) => handleMouseOver(e, hoverColors.red)}
        onMouseOut={handleMouseOut}
      >
        Red Button
      </button>
    </div>
  );
};


// Usage Example:
// <ColoredButtons />
