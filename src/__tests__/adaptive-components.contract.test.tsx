import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("../AdaptiveProvider", () => ({
  useAdaptive: jest.fn(),
}));

import { useAdaptive } from "../AdaptiveProvider";
import { AdaptiveAlert } from "../components/AdaptiveAlert";
import { AdaptiveButton } from "../components/AdaptiveButton";
import { AdaptiveCard } from "../components/AdaptiveCard";
import { AdaptiveCheckbox } from "../components/AdaptiveCheckbox";
import { AdaptiveDialog } from "../components/AdaptiveDialog";
import { AdaptiveDrawer } from "../components/AdaptiveDrawer";
import { AdaptiveDropdown } from "../components/AdaptiveDropdown";
import { AdaptiveGrid } from "../components/AdaptiveGrid";
import { AdaptiveInput } from "../components/AdaptiveInput";
import { AdaptiveList } from "../components/AdaptiveList";
import { AdaptiveMenu } from "../components/AdaptiveMenu";
import { AdaptiveNavbar } from "../components/AdaptiveNavbar";
import { AdaptivePagination } from "../components/AdaptivePagination";
import { AdaptiveSelect } from "../components/AdaptiveSelect";
import { AdaptiveSwitch } from "../components/AdaptiveSwitch";
import { AdaptiveTable } from "../components/AdaptiveTable";
import { AdaptiveText } from "../components/AdaptiveText";
import { AdaptiveTextarea } from "../components/AdaptiveTextarea";
import { AdaptiveTooltip } from "../components/AdaptiveTooltip";

import { MOCK_ADAPTIVE_CONTEXT, setWindowSize, TEST_TOKENS } from "./testUtils";

const mockedUseAdaptive = useAdaptive as jest.MockedFunction<typeof useAdaptive>;

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => value + value)
          .join("")
      : normalized;
  const intValue = Number.parseInt(expanded, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

describe("adaptive component contracts", () => {
  beforeEach(() => {
    mockedUseAdaptive.mockReturnValue(MOCK_ADAPTIVE_CONTEXT as ReturnType<typeof useAdaptive>);
    setWindowSize(1280, 800);
  });

  it("applies token-driven typography and target sizing to interactive form primitives", () => {
    render(
      <>
        <AdaptiveButton>Continue</AdaptiveButton>
        <AdaptiveText>Readable content</AdaptiveText>
        <AdaptiveInput label="Email" />
        <AdaptiveSelect
          label="Role"
          options={[
            { value: "admin", label: "Admin" },
            { value: "user", label: "User" },
          ]}
        />
        <AdaptiveTextarea label="Notes" example="Provide more detail" />
        <AdaptiveCheckbox label="Accept terms" defaultChecked={true} />
        <AdaptiveSwitch label="Enable sync" defaultChecked={true} />
      </>
    );

    expect(screen.getByRole("button", { name: "Continue" })).toHaveStyle({
      minHeight: "52px",
      fontSize: "20px",
      backgroundColor: TEST_TOKENS.colors.primary,
    });
    expect(screen.getByText("Readable content")).toHaveStyle({
      fontSize: "20px",
      lineHeight: "1.9",
    });
    expect(screen.getByPlaceholderText("Email")).toHaveStyle({
      minHeight: "52px",
      fontSize: "20px",
    });
    expect(screen.getByRole("combobox")).toHaveStyle({
      minHeight: "52px",
      fontSize: "20px",
    });
    expect(screen.getByPlaceholderText("Provide more detail")).toHaveStyle({
      lineHeight: "1.9",
      resize: "both",
    });
    expect(screen.getByText("Accept terms")).toHaveStyle({
      fontSize: "20px",
      color: TEST_TOKENS.colors.text,
    });
    expect(screen.getByRole("switch", { name: "Enable sync" })).toHaveStyle({
      minHeight: "52px",
    });
  });

  it("simplifies layout-aware components according to the ML profile", () => {
    const { container } = render(
      <>
        <AdaptiveCard>
          <AdaptiveCard.Media src="/hero.png" alt="Hero" />
          <AdaptiveCard.Body>Body copy</AdaptiveCard.Body>
          <AdaptiveCard.Actions>
            <button type="button">Primary action</button>
            <button type="button">Secondary action</button>
          </AdaptiveCard.Actions>
        </AdaptiveCard>

        <AdaptiveGrid withContainerPadding>
          <div>Cell 1</div>
          <div>Cell 2</div>
        </AdaptiveGrid>

        <AdaptiveList ariaLabel="Results">
          <AdaptiveList.Row>
            <AdaptiveList.Content>
              <AdaptiveList.Title>Result A</AdaptiveList.Title>
            </AdaptiveList.Content>
          </AdaptiveList.Row>
        </AdaptiveList>

        <AdaptiveMenu
          items={[
            { id: "item-1", label: "Dashboard", selected: true },
            { id: "item-2", label: "Settings" },
          ]}
        />

        <AdaptiveNavbar>
          <AdaptiveNavbar.Brand>NovaCart</AdaptiveNavbar.Brand>
          <AdaptiveNavbar.Nav>
            <AdaptiveNavbar.Item href="#products">Products</AdaptiveNavbar.Item>
            <AdaptiveNavbar.Item href="#pricing">Pricing</AdaptiveNavbar.Item>
          </AdaptiveNavbar.Nav>
          <AdaptiveNavbar.Spacer />
          <AdaptiveNavbar.Actions>
            <button type="button">Sign in</button>
            <button type="button">Sign up</button>
          </AdaptiveNavbar.Actions>
        </AdaptiveNavbar>

        <AdaptivePagination currentPage={2} totalPages={5} />

        <AdaptiveTable
          columns={[
            { id: "name", header: "Name", accessor: "name" },
            { id: "status", header: "Status", accessor: "status" },
          ]}
          data={[
            { id: "1", name: "Order 1", status: "Paid" },
            { id: "2", name: "Order 2", status: "Pending" },
          ]}
          rowKey="id"
        />
      </>
    );

    expect(screen.queryByRole("img", { name: "Hero" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Primary action" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Secondary action" })).not.toBeInTheDocument();

    const grid = container.querySelector(".adaptive-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain("repeat(1,");
    expect(grid.style.padding).toBe("28px 32px");

    expect(container.querySelector(".adaptive-list__row")).toHaveStyle({
      minHeight: "52px",
    });
    const dashboardButton = screen.getByRole("button", { name: "Dashboard" });
    expect(dashboardButton.style.minHeight).toBe("64px");
    expect(dashboardButton.style.backgroundColor).toBe(hexToRgb(TEST_TOKENS.colors.surface));

    const navbar = container.querySelector(".adaptive-navbar") as HTMLElement;
    expect(navbar).toHaveStyle({
      minHeight: "80px",
      backgroundColor: TEST_TOKENS.colors.surface,
    });

    expect(screen.getByRole("button", { name: "Page 2" })).toHaveStyle({
      backgroundColor: TEST_TOKENS.colors.primary,
      color: TEST_TOKENS.colors.onPrimary,
    });

    const tableElement = within(container.querySelector(".adaptive-table") as HTMLElement).getByRole("table");
    expect(tableElement).toHaveStyle({
      fontSize: "20px",
      color: TEST_TOKENS.colors.text,
    });
  });

  it("renders assistive and overlay components with the current ML-driven affordances", () => {
    const onClose = jest.fn();
    const { container } = render(
      <>
        <AdaptiveDropdown
          label="Actions"
          items={[
            { id: "edit", label: "Edit" },
            { id: "share", label: "Share" },
          ]}
        />

        <AdaptiveTooltip text="Detailed tooltip">
          <button type="button">Info</button>
        </AdaptiveTooltip>

        <AdaptiveAlert title="Profile applied">High-contrast state</AdaptiveAlert>

        <AdaptiveDrawer
          open={true}
          onClose={onClose}
          items={[{ id: "home", label: "Home" }]}
        />

        <AdaptiveDialog open={true} onClose={onClose} description="Dialog body">
          Dialog content
        </AdaptiveDialog>
      </>
    );

    const dropdownTrigger = screen.getByRole("button", { name: "Actions" });
    expect(dropdownTrigger).toHaveStyle({ minHeight: "64px" });
    fireEvent.click(dropdownTrigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Info" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Detailed tooltip");

    expect(screen.getByRole("status")).toHaveStyle({
      borderColor: TEST_TOKENS.colors.primary,
      color: TEST_TOKENS.colors.text,
    });

    expect(screen.getByRole("dialog", { name: "Menu" })).toHaveStyle({
      width: "360px",
      background: TEST_TOKENS.colors.surface,
    });
    expect(screen.getByRole("button", { name: "Close drawer" })).toHaveStyle({
      height: "52px",
      minWidth: "52px",
    });

    const dialogs = screen.getAllByRole("dialog");
    const adaptiveDialog = dialogs.find((node) =>
      node.getAttribute("aria-labelledby")?.includes("aura-dialog-title")
    ) as HTMLElement;
    expect(adaptiveDialog).toHaveStyle({
      border: `2px solid ${TEST_TOKENS.colors.text}`,
      background: TEST_TOKENS.colors.surface,
    });
    expect(within(adaptiveDialog).getByRole("button", { name: "Close dialog" })).toHaveStyle({
      height: "52px",
      minWidth: "52px",
    });

    expect(container.querySelector(".adaptive-alert")).toBeInTheDocument();
  });
});
