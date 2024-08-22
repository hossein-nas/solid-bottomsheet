import { Portal } from "solid-js/web";
import {
  Component,
  createEffect,
  createSignal,
  JSX,
  onCleanup,
  onMount,
} from "solid-js";

const DEFAULT_THRESHOLD = 50;

export interface BaseSolidBottomsheetProps {
  children: JSX.Element;
  onClose: () => void;
  close: boolean;
}

export interface DefaultVariantProps extends BaseSolidBottomsheetProps {
  variant: "default";
}

export interface SnapVariantProps extends BaseSolidBottomsheetProps {
  variant: "snap";
  defaultSnapPoint: ({ maxHeight }: { maxHeight: number }) => number;
  snapPoints: ({ maxHeight }: { maxHeight: number }) => number[];
}

export type SolidBottomsheetProps = DefaultVariantProps | SnapVariantProps;

export const SolidBottomsheet: Component<SolidBottomsheetProps> = (props) => {
  const [scrollPosition, setScrollPosition] = createSignal(
    window.pageYOffset || document.documentElement.scrollTop
  );
  const screenMaxHeight = window.visualViewport?.height ?? window.screen.height;

  const isSnapVariant = props.variant === "snap";

  let bodyRef: HTMLDivElement = null!;
  let handleBarRef: HTMLDivElement = null!;

  const [maxHeight, setMaxHeight] = createSignal(screenMaxHeight);
  const [isClosing, setIsClosing] = createSignal(false);
  const [isSnapping, setIsSnapping] = createSignal(false);

  const getDefaultTranslateValue = () => {
    if (isSnapVariant) {
      const defaultValue = props.defaultSnapPoint({ maxHeight: maxHeight() });
      if (defaultValue !== maxHeight()) {
        return window.innerHeight - defaultValue;
      }
    }
    return 0;
  };

  const getSnapPoints = (maxHeight: number): number[] => {
    return isSnapVariant
      ? [0, ...props.snapPoints({ maxHeight }).sort((a, b) => b - a)]
      : [];
  };

  const clampInRange = ({
    minimum,
    maximum,
    current,
  }: Record<"minimum" | "maximum" | "current", number>): number =>
    Math.min(Math.max(current, minimum), maximum);

  const [bottomsheetTranslateValue, setBottomsheetTranslateValue] =
    createSignal(getDefaultTranslateValue());

  const onViewportChange = () => {
    setScrollPosition(window.pageYOffset || document.documentElement.scrollTop);
    const screenMaxHeight =
      window.visualViewport?.height ?? window.screen.height;

    const bodyHeight =
      screenMaxHeight -
      handleBarRef.getBoundingClientRect().height * 8 -
      bottomsheetTranslateValue();

    console.log({
      visualViewport: window.visualViewport,
      screen: window.screen,
      screenMaxHeight,
      handleBarHeight: handleBarRef?.getBoundingClientRect().height * 8,
      bottomsheetTranslateValue: bottomsheetTranslateValue(),
    });

    bodyRef.style.setProperty("height", `${bodyHeight}px`);

    setMaxHeight(screenMaxHeight);

    if (
      document.activeElement &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement?.focus?.();
    }
  };

  const freezeBody = () => {
    // Save the current scroll position

    // Add a fixed position to prevent jumping
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollPosition()}px`;
    document.body.style.width = "100%";
  };

  const releaseBody = () => {
    // Remove the fixed position and restore the scroll position
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";

    // Restore the scroll position
    window.scrollTo(0, scrollPosition());
  };

  onMount(() => {
    document.body.classList.add("sb-overflow-hidden");
    freezeBody();

    onCleanup(() => {
      document.body.classList.remove("sb-overflow-hidden");
      releaseBody();
    });
    onViewportChange();
  });

  createEffect(() => {
    snapPoints = getSnapPoints(maxHeight());
  });

  createEffect(() => {
    if (props.close) {
      setIsClosing(true);
    }
  });

  let snapPoints: number[] = [];

  let touchStartPosition = 0;
  let lastTouchPosition = 0;

  const onTouchStart: JSX.EventHandlerUnion<HTMLDivElement, TouchEvent> = (
    event
  ) => {
    isSnapVariant && setIsSnapping(false);

    touchStartPosition = lastTouchPosition = event.touches[0].clientY;
  };

  const onTouchMove: JSX.EventHandlerUnion<HTMLDivElement, TouchEvent> = (
    event
  ) => {
    let dragDistance = 0;

    switch (props.variant) {
      case "snap":
        dragDistance = event.touches[0].clientY - lastTouchPosition;

        setBottomsheetTranslateValue((previousVal) =>
          clampInRange({
            minimum: 0,
            maximum: maxHeight(),
            current: previousVal + dragDistance,
          })
        );

        lastTouchPosition = event.touches[0].clientY;

        break;
      case "default":
      default:
        lastTouchPosition = event.touches[0].clientY;
        dragDistance = lastTouchPosition - touchStartPosition;

        if (dragDistance > 0) {
          setBottomsheetTranslateValue(dragDistance);
        }

        break;
    }
  };

  const onTouchEnd: JSX.EventHandlerUnion<HTMLDivElement, TouchEvent> = () => {
    let currentPoint = 0;
    let closestPoint = 0;

    switch (props.variant) {
      case "snap":
        currentPoint = maxHeight() - lastTouchPosition;

        closestPoint = snapPoints.reduce((previousVal, currentVal) => {
          return Math.abs(currentVal - currentPoint) <
            Math.abs(previousVal - currentPoint)
            ? currentVal
            : previousVal;
        });

        if (closestPoint === 0) {
          setIsClosing(true);
          break;
        }

        setIsSnapping(true);
        setBottomsheetTranslateValue(maxHeight() - closestPoint);

        break;
      case "default":
      default:
        if (lastTouchPosition - touchStartPosition > DEFAULT_THRESHOLD) {
          setIsClosing(true);
        } else {
          setBottomsheetTranslateValue(0);
        }

        break;
    }
  };

  const onOverlayClick: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (
    event
  ) => {
    if (event.target.className === "sb-overlay") {
      setIsClosing(true);
    }
  };

  const handleClose = () => {
    props.onClose();
    releaseBody();
  };

  return (
    <Portal>
      <div class="sb-overlay" onClick={onOverlayClick}>
        <div
          classList={{
            "sb-content": true,
            "sb-is-closing": isClosing(),
            "sb-is-snapping": isSnapping(),
          }}
          style={{
            transform: `translateY(${bottomsheetTranslateValue()}px)`,
            "padding-bottom": `${bottomsheetTranslateValue()}px`,
            ...(isSnapVariant ? { height: `${maxHeight()}px` } : {}),
          }}
          {...(isClosing() ? { onAnimationEnd: handleClose } : {})}
        >
          <div
            class="sb-handle-container"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div class="sb-handle" ref={handleBarRef} />
          </div>
          <div ref={bodyRef}>{props.children}</div>
        </div>
      </div>
    </Portal>
  );
};
