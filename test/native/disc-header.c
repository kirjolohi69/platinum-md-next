/* Allocation and parsing use one validated header. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libnetmd.h"
static const char *header;
static int calls,result,status;
int netmd_exch_message(netmd_dev_handle *dev,unsigned char *cmd,const size_t length,unsigned char *out) {
    (void)dev;assert(length==19 && cmd[2]==6);calls++;
    if(result<0)return result;
    memset(out,0,255);out[0]=(unsigned char)status;
    if(result>=25)memcpy(out+25,header,strlen(header));return result;
}
static void reset(const char *text) {header=text;calls=0;result=25+(int)strlen(text);status=NETMD_STATUS_ACCEPTED;}
static void dispose(minidisc *md) {for(unsigned i=0;i<md->group_count;i++)free(md->groups[i].name);free(md->groups);}
int main(void) {
    minidisc md={0};netmd_set_log_level(NETMD_LOG_NONE);
    reset("");assert(netmd_initialize_disc_info(NULL,&md)==0);assert(calls==1 && md.group_count==1);dispose(&md);
    reset("0;Test//1-2;Group A//3;Group B//");assert(netmd_initialize_disc_info(NULL,&md)>0);
    assert(calls==1 && md.group_count==3 && strcmp(md.groups[2].name,"Group B")==0);dispose(&md);
    reset("Plain title");assert(netmd_initialize_disc_info(NULL,&md)>0);assert(calls==1 && md.group_count==1);dispose(&md);
    reset("0;Grouped//1;A//");result=NETMDERR_USB;assert(netmd_initialize_disc_info(NULL,&md)<0);assert(calls==1 && md.groups==NULL && md.group_count==0);
    reset("");result=24;assert(netmd_initialize_disc_info(NULL,&md)<0);assert(md.groups==NULL);
    reset("");status=NETMD_STATUS_REJECTED;assert(netmd_initialize_disc_info(NULL,&md)==NETMDERR_CMD_INVALID);assert(md.groups==NULL);
    puts("Native disc header: 6 cases passed (blank/grouped discs and failed reads).");
}
