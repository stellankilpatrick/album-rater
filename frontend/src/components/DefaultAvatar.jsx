import { useId } from "react";

function DefaultAvatar({ size = 28 }) {
  const clipId = `avatar-body-clip-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block", borderRadius: "50%" }}
    >
      <circle cx="50" cy="50" r="50" fill="#ccd3d9" />
      <circle cx="50" cy="40" r="18" fill="white" />
      <clipPath id={clipId}>
        <circle cx="50" cy="50" r="50" />
      </clipPath>
      <ellipse cx="50" cy="98" rx="34" ry="30" fill="white" clipPath={`url(#${clipId})`} />
    </svg>
  );
}

export default DefaultAvatar;
