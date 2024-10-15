const std = @import("std");

const version = std.SemanticVersion{ .major = 0, .minor = 1, .patch = 0, .pre = "dev" };
const version_date = "10-13-2024";
const description = "Build tool/Package manager for the Ruka Programming Language";

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const optimize = b.standardOptimizeOption(.{});

    const bin = b.addExecutable(.{
        .name = "ruka",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize
    });

    b.installArtifact(bin);

    var options = b.addOptions();
    options.addOption(std.SemanticVersion, "version", getVersion(b));
    options.addOption([]const u8, "version_date", getDate(b));
    options.addOption([]const u8, "description", description);
    bin.root_module.addOptions("options", options);

    const run_cmd = b.addRunArtifact(bin);

    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Tests
    const bin_unit_tests = b.addTest(.{
        .name = "bin_test",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .test_runner = b.path("tests/test_runner.zig"),
        .optimize = optimize,
    });

    const run_bin_unit_tests = b.addRunArtifact(bin_unit_tests);
    run_bin_unit_tests.addArg("--suite bin");

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_bin_unit_tests.step);

    const coverage_step = b.step("coverage", "Generate test coverage");

    const merge_step = std.Build.Step.Run.create(b, "merge coverage");
    merge_step.addArgs(&.{ "kcov", "--merge" });
    merge_step.rename_step_with_output_arg = false;
    const merged_coverage_output = merge_step.addOutputFileArg(".");

    // Bin test coverage
    {
        const kcov_collect = std.Build.Step.Run.create(b, "collect bin coverage");
        kcov_collect.addArgs(&.{ "kcov", "--collect-only" });
        kcov_collect.addPrefixedDirectoryArg("--include-pattern=", b.path("src"));
        merge_step.addDirectoryArg(kcov_collect.addOutputFileArg(bin_unit_tests.name));
        kcov_collect.addArtifactArg(bin_unit_tests);
        kcov_collect.enableTestRunnerMode();
    }

    const install_coverage = b.addInstallDirectory(.{
        .source_dir = merged_coverage_output,
        .install_dir = .{ .custom = "coverage" },
        .install_subdir = ""
    });
    coverage_step.dependOn(&install_coverage.step);
}

fn getVersion(b: *std.Build) std.SemanticVersion {
    if (version.pre == null and version.build == null) return version;

    var code: u8 = undefined;
    const sha_untrimmed = b.runAllowFail(&.{
        "git", "rev-parse", "--short", "HEAD"
    }, &code, .Ignore) catch return version;

    const sha = std.mem.trim(u8, sha_untrimmed, " \n\r");

    const commit_height_untrimmed = b.runAllowFail(&.{
        "git", "rev-list", "HEAD", "--count"
    }, &code, .Ignore) catch return version;

    const commit_height = std.mem.trim(u8, commit_height_untrimmed, " \n\r");

    return std.SemanticVersion {
        .major = version.major,
        .minor = version.minor,
        .patch = version.patch,
        .pre = b.fmt("dev.{s}", .{commit_height}),
        .build = sha
    };
}

fn getDate(b: *std.Build) []const u8 {
    var code: u8 = undefined;
    const date_untrimmed = b.runAllowFail(&.{
        "date", "+'%m/%d/%Y'"
    }, &code, .Ignore) catch return version_date;
    const date = std.mem.trim(u8, date_untrimmed, " \n\r");

    return date;
}
