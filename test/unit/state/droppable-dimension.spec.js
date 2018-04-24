// @flow
import {
  createBox,
  withScroll,
  getRect,
  type BoxModel,
} from 'css-box-model';
import {
  getDroppableDimension,
  scrollDroppable,
  clip,
} from '../../../src/state/droppable-dimension';
import { offsetByPosition } from '../../../src/state/spacing';
import getArea from '../../../src/state/get-area';
import { negate } from '../../../src/state/position';
import getMaxScroll from '../../../src/state/get-max-scroll';
import { getClosestScrollable } from '../../utils/dimension';
import { noSpacing } from '../../../src/state/dimension';
import { expandBySpacing, shrinkBySpacing } from '../../utils/spacing';
import type {
  Spacing,
  DroppableDescriptor,
  Position,
  DroppableDimension,
  Scrollable,
  DroppableDimensionViewport,
} from '../../../src/types';

const descriptor: DroppableDescriptor = {
  id: 'drop-1',
  type: 'TYPE',
};

const margin: Spacing = {
  top: 1, right: 2, bottom: 3, left: 4,
};
const padding: Spacing = {
  top: 5, right: 6, bottom: 7, left: 8,
};
const border: Spacing = {
  top: 9, right: 10, bottom: 11, left: 12,
};
const windowScroll: Position = {
  x: 50,
  y: 80,
};
const origin: Position = { x: 0, y: 0 };

const client: BoxModel = createBox({
  borderBox: {
    top: 10,
    right: 110,
    bottom: 90,
    left: 20,
  },
  margin,
  padding,
  border,
});
const page: BoxModel = withScroll(client, windowScroll);
const ten: Spacing = {
  top: 10, right: 10, bottom: 10, left: 10,
};

describe('creating a droppable dimension', () => {
  describe('closest scrollable', () => {
    describe('no closest scrollable', () => {
      it('should not have a closest scrollable if there is no closest scrollable', () => {
        const dimension: DroppableDimension = getDroppableDimension({
          descriptor,
          isEnabled: true,
          client,
          page,
          direction: 'vertical',
          closest: null,
        });

        expect(dimension.viewport.closestScrollable).toBe(null);
        expect(dimension.viewport.subject).toEqual(dimension.viewport.clipped);
      });
    });

    describe('with a closest scrollable', () => {
      const dimension: DroppableDimension = getDroppableDimension({
        descriptor,
        isEnabled: true,
        client,
        page,
        direction: 'vertical',
        closest: {
          client,
          page,
          scrollHeight: client.paddingBox.height,
          scrollWidth: client.paddingBox.width,
          scroll: { x: 10, y: 10 },
          shouldClipSubject: true,
        },
      });

      it('should offset the frame client by the window scroll', () => {
        expect(getClosestScrollable(dimension).frame).toEqual(page.borderBox);
      });

      it('should capture the viewport information', () => {
        const maxScroll: Position = getMaxScroll({
          // scrollHeight and scrollWidth are based on the padding box
          scrollHeight: client.paddingBox.height,
          scrollWidth: client.paddingBox.width,
          height: client.paddingBox.height,
          width: client.paddingBox.width,
        });
        const expected: DroppableDimensionViewport = {
          closestScrollable: {
            frame: page.borderBox,
            shouldClipSubject: true,
            scroll: {
              initial: { x: 10, y: 10 },
              current: { x: 10, y: 10 },
              max: maxScroll,
              diff: {
                value: { x: 0, y: 0 },
                displacement: { x: 0, y: 0 },
              },
            },
          },
          subject: page.borderBox,
          clipped: page.borderBox,
        };

        expect(dimension.viewport).toEqual(expected);
      });
    });

    describe('frame clipping', () => {
      const frameClient: BoxModel = createBox({
        // bigger on every side by 10px
        borderBox: expandBySpacing(client.borderBox, ten),
        margin,
        border,
        padding,
      });
      const framePage: BoxModel = withScroll(frameClient, windowScroll);

      type Options = {|
        shouldClipSubject: boolean,
      |}

      const defaultOptions: Options = { shouldClipSubject: true };

      const getWithClient = (
        customClient: BoxModel,
        options?: Options = defaultOptions,
      ): DroppableDimension => getDroppableDimension({
        descriptor,
        isEnabled: true,
        client: customClient,
        page: withScroll(customClient, windowScroll),
        direction: 'vertical',
        closest: {
          client: frameClient,
          page: framePage,
          scrollHeight: client.paddingBox.height,
          scrollWidth: client.paddingBox.width,
          scroll: origin,
          shouldClipSubject: options.shouldClipSubject,
        },
      });

      it('should not clip the frame if requested not to', () => {
        const expandedClient: BoxModel = createBox({
          borderBox: expandBySpacing(frameClient.borderBox, ten),
          margin,
          padding,
          border,
        });
        const expandedPage: BoxModel = withScroll(expandedClient, windowScroll);
        const bigClient: BoxModel = createBox({
          borderBox: expandedClient.borderBox,
          margin,
          padding,
          border,
        });

        const droppable: DroppableDimension = getWithClient(
          bigClient, { shouldClipSubject: false },
        );

        // Not clipped
        expect(droppable.viewport.subject).toEqual(expandedPage.borderBox);
        expect(droppable.viewport.clipped).toEqual(expandedPage.borderBox);
        expect(getClosestScrollable(droppable).shouldClipSubject).toBe(false);
      });

      describe('frame is the same size as the subject', () => {
        it('should not clip the subject', () => {
          const droppable: DroppableDimension = getWithClient(frameClient);

          expect(droppable.viewport.clipped).toEqual(framePage.borderBox);
        });
      });

      describe('frame is smaller than subject', () => {
        it('should clip the subject to the size of the frame', () => {
          const bigClient: BoxModel = createBox({
            // expanding by 10px on each side
            borderBox: expandBySpacing(frameClient.borderBox, ten),
            margin,
            padding,
            border,
          });

          const droppable: DroppableDimension = getWithClient(bigClient);

          expect(droppable.viewport.clipped).toEqual(framePage.borderBox);
        });
      });

      describe('frame is larger than subject', () => {
        it('should return a clipped size that is equal to that of the subject', () => {
          // client is already smaller than frame
          const droppable: DroppableDimension = getWithClient(client);

          expect(droppable.viewport.clipped).toEqual(page.borderBox);
        });
      });

      describe('subject clipped on one side by frame', () => {
        it('should clip on all sides', () => {
          // each of these subjects bleeds out past the frame in one direction
          const changes: Spacing[] = [
            { top: -10, ...noSpacing },
            { left: -10, ...noSpacing },
            { bottom: 10, ...noSpacing },
            { right: 10, ...noSpacing },
          ];

          changes.forEach((expandBy: Spacing) => {
            const custom: BoxModel = createBox({
              borderBox: expandBySpacing(frameClient.borderBox, expandBy),
              margin,
              padding,
              border,
            });

            const droppable: DroppableDimension = getWithClient(custom);

            expect(droppable.viewport.clipped).toEqual(framePage.borderBox);
          });
        });
      });
    });
  });
});

describe('scrolling a droppable', () => {
  it('should update the frame scroll and the clipping', () => {
    const scrollSize = {
      scrollHeight: 500,
      scrollWidth: 100,
    };
    const subject = getArea({
      // 500 px high
      top: 0,
      bottom: scrollSize.scrollHeight,
      right: scrollSize.scrollWidth,
      left: 0,
    });
    const frameBorderBox = getArea({
      // only viewing top 100px
      bottom: 100,
      // unchanged
      top: 0,
      right: scrollSize.scrollWidth,
      left: 0,
    });
    const frameScroll: Position = { x: 0, y: 0 };
    const droppable: DroppableDimension = getDroppableDimension({
      descriptor,
      borderBox: subject,
      closest: {
        frameBorderBox,
        scroll: frameScroll,
        scrollWidth: scrollSize.scrollWidth,
        scrollHeight: scrollSize.scrollHeight,
        shouldClipSubject: true,
      },
    });

    const closestScrollable: Scrollable = getClosestScrollable(droppable);

    // original frame
    expect(closestScrollable.frame).toEqual(frameBorderBox);
    // subject is currently clipped by the frame
    expect(droppable.viewport.clipped).toEqual(frameBorderBox);

    // scrolling down
    const newScroll: Position = { x: 0, y: 100 };
    const updated: DroppableDimension = scrollDroppable(droppable, newScroll);
    const updatedClosest: Scrollable = getClosestScrollable(updated);

    // unchanged frame client
    expect(updatedClosest.frame).toEqual(frameBorderBox);

    // updated scroll info
    expect(updatedClosest.scroll).toEqual({
      initial: frameScroll,
      current: newScroll,
      diff: {
        value: newScroll,
        displacement: negate(newScroll),
      },
      max: getMaxScroll({
        scrollWidth: scrollSize.scrollWidth,
        scrollHeight: scrollSize.scrollHeight,
        width: frameBorderBox.width,
        height: frameBorderBox.height,
      }),
    });

    // updated clipped
    // can now see the bottom half of the subject
    expect(updated.viewport.clipped).toEqual(getArea({
      top: 0,
      bottom: 100,
      // unchanged
      right: 100,
      left: 0,
    }));
  });

  it('should allow scrolling beyond the max position', () => {
    // this is to allow for scrolling into a foreign placeholder
    const scrollable: DroppableDimension = getDroppableDimension({
      descriptor,
      borderBox: getArea({
        top: 0,
        left: 0,
        right: 200,
        bottom: 200,
      }),
      closest: {
        frameBorderBox: getArea({
          top: 0,
          left: 0,
          right: 100,
          bottom: 100,
        }),
        scroll: { x: 0, y: 0 },
        scrollWidth: 200,
        scrollHeight: 200,
        shouldClipSubject: true,
      },
    });

    const scrolled: DroppableDimension = scrollDroppable(scrollable, { x: 300, y: 300 });

    // current is larger than max
    expect(getClosestScrollable(scrolled).scroll.current).toEqual({ x: 300, y: 300 });
    // current max is unchanged
    expect(getClosestScrollable(scrolled).scroll.max).toEqual({ x: 100, y: 100 });
    // original max
    expect(getClosestScrollable(scrollable).scroll.max).toEqual({ x: 100, y: 100 });
  });
});

describe('clip', () => {
  it('should select clip a subject in a frame', () => {
    const subject: Area = getArea({
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
    });
    const frame: Area = getArea({
      top: 20,
      left: 20,
      right: 50,
      bottom: 50,
    });

    expect(clip(frame, subject)).toEqual(frame);
  });

  it('should return null when the subject it outside the frame on any side', () => {
    const frame: Area = getArea({
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
    });
    const outside: Spacing[] = [
      // top
      offsetByPosition(frame, { x: 0, y: -200 }),
      // right
      offsetByPosition(frame, { x: 200, y: 0 }),
      // bottom
      offsetByPosition(frame, { x: 0, y: 200 }),
      // left
      offsetByPosition(frame, { x: -200, y: 0 }),
    ];

    outside.forEach((subject: Spacing) => {
      expect(clip(frame, subject)).toEqual(null);
    });
  });
});