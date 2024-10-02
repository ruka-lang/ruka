// @author: ruka-lang
// @created: 2024-09-13

const std = @import("std");

millisecond: u16,
second: u8,
minute: u8,
hour: u8,
day: u8,
weekday: Weekday,
month: Month,
year: isize,

timezone: Timezone,

const Chrono = @This();

const Timezone = enum {
    CST,
    EST,
    PST,
    UTC,

    pub fn toString(self: @This()) []const u8 {
        return @tagName(self);
    }
};

///
pub const epoch_unix = Chrono {
    .millisecond = 0,
    .second = 0,
    .minute = 0,
    .hour = 0,
    .day = 1,
    .weekday = .thursday,
    .month = .january,
    .year = 1970,
    .timezone = .UTC
};

pub fn initEpoch() Chrono {
    return epoch_unix;
}

// TODO fix calculations and include timezone adjustments
pub fn init(timezone: Timezone) Chrono {
    const time = std.time.milliTimestamp();

    var chrono: Chrono = undefined;
    chrono.timezone = timezone;

    const milliseconds: u64 = @intCast(time);
    const seconds = @divTrunc(milliseconds, 1000);
    const minutes = @divTrunc(seconds, 60);
    const hours = @divTrunc(minutes, 60);
    const days = @divTrunc(hours, 24);

    chrono.month, chrono.day, chrono.year = calculateMonthAndDayAndYear(days);
    chrono.hour = @truncate(std.math.clamp(hours - @as(u16, chrono.day) * 24, 0, 24));
    chrono.minute = @truncate(std.math.clamp(minutes - @as(u16, chrono.hour) * 60, 0, 59));
    chrono.second = @truncate(std.math.clamp(seconds - @as(u16, chrono.minute) * 60, 0, 59));
    chrono.millisecond = @truncate(std.math.clamp(milliseconds - @as(u32, chrono.second) * 1000, 0, 99));

    std.debug.print("{} {}, {}\n", .{chrono.month, chrono.day, chrono.year});

    return chrono;
}

pub fn deinit(self: Chrono) void {
    _ = self;
}

fn calculateMonthAndDayAndYear(days: u64) std.meta.Tuple(&.{Month, u8, isize}) {
    const daysPerMonth = &Month.daysPerMonth;
    var daysSinceUnixJanuary: u64 = @intCast(days);
    var month = epoch_unix.month;
    var year = epoch_unix.year;
    var leap = isLeapYear(year);

    while (moreDaysThanInMonth(daysSinceUnixJanuary, month, year)) {
        if (isLeapYear(year) and month == .february) {
            daysSinceUnixJanuary -= daysPerMonth.get(month.toString()).? + 1;
        } else {
            daysSinceUnixJanuary -= daysPerMonth.get(month.toString()).?;
        }

        month = month.next();

        if (month == .january) {
            year += 1;
            leap = isLeapYear(year);
        }
    }

    return .{month, @truncate(daysSinceUnixJanuary), year};
}

fn moreDaysThanInMonth(days: u64, month: Month, year: i64) bool {
    const daysPerMonth = &Month.daysPerMonth;

    return  (isLeapYear(year) and month == .february and days > daysPerMonth.get(month.toString()).? + 1) or 
            days > daysPerMonth.get(month.toString()).?;
}

fn isLeapYear(year: i64) bool {
    if (@mod(year, 4) == 0) {
        if (@mod(year, 100) != 0) {
            return true;
        } else {
            if (@mod(year, 400) == 0) {
                return true;
            }

            return false;
        }
    }

    return false;
}

///
pub const Weekday = enum {
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,

    pub fn toString(self: Weekday) []const u8 {
        return @tagName(self);
    }
};

///
pub const Month = enum {
    january,
    february,
    march,
    april,
    may,
    june,
    july,
    august,
    september,
    october,
    november,
    december,

    pub fn next(self: Month) Month {
        return switch (self) {
            .december => .january,
            else => @enumFromInt(@intFromEnum(self) + 1)
        };
    }

    pub fn toString(self: Month) []const u8 {
        return @tagName(self);
    }

    pub const daysPerMonth = std.StaticStringMap(usize).initComptime(.{
        .{"january", 31},
        .{"february", 28}, //29 on a leap year
        .{"march", 31},
        .{"april", 30},
        .{"may", 31},
        .{"june", 30},
        .{"july", 31},
        .{"august", 31},
        .{"september", 30},
        .{"october", 31},
        .{"november", 30},
        .{"december", 31}
    });
};

test "test chrono module" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;
    const allocator = testing.allocator;

    test "epoch initialization" {
        const chrono: Chrono = .init(.UTC);
        try testing.expect(chrono.timezone == .UTC);
    }
};
